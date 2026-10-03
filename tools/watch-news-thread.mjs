// Local T3 supervisor. Run with a systemd user timer; credentials stay outside git.
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'undici';

export const marker = '[news-crawl-watchdog]';
export function decision(thread, session, state, latestUser, now = Date.now()) {
  if (!thread || thread.deleted_at || thread.archived_at) return 'inactive';
  if (state.stopped) return 'stopped';
  if (latestUser && !latestUser.text.startsWith(marker) && /^(?:停止|暫停|不要再|stop\b|pause\b)/i.test(latestUser.text.trim()))
    return 'stop-requested';
  if (thread.pending_approval_count || thread.pending_user_input_count) return 'waiting-for-user';
  if (session?.status === 'running' || session?.status === 'starting') return 'running';
  if (state.lastKickAt && now - Date.parse(state.lastKickAt) < 300_000) return 'cooldown';
  return 'kick';
}

export async function rpc(origin, token, tag, payload) {
  const url = new URL('/ws', origin);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Only local T3 servers are supported');
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return new Promise((resolveResult, reject) => {
    const socket = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } });
    const timer = setTimeout(() => finish(new Error('T3 RPC timeout')), 20_000);
    function finish(error, value) {
      clearTimeout(timer);
      socket.close();
      if (error) reject(error);
      else resolveResult(value);
    }
    socket.addEventListener('open', () =>
      socket.send(
        JSON.stringify({
          _tag: 'Request',
          id: '1',
          tag,
          payload,
          headers: [],
        }),
      ),
    );
    socket.addEventListener('error', () => finish(new Error('T3 WebSocket connection failed')));
    socket.addEventListener('message', ({ data }) => {
      const decoded = JSON.parse(String(data));
      for (const response of Array.isArray(decoded) ? decoded : [decoded]) {
        if (response._tag === 'Ping') socket.send(JSON.stringify({ _tag: 'Pong' }));
        if (response._tag === 'Defect') finish(new Error(JSON.stringify(response.defect)));
        if (response._tag === 'Exit' && response.requestId === '1') {
          if (response.exit._tag === 'Success') finish(null, response.exit.value);
          else finish(new Error(JSON.stringify(response.exit.cause)));
        }
      }
    });
  });
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw error;
  }
}

export async function main() {
  const configPath = process.env.NEWS_WATCH_CONFIG;
  if (!configPath) throw new Error('Set NEWS_WATCH_CONFIG to a local JSON config');
  const config = readJson(configPath);
  const state = readJson(config.statePath, {});
  const db = new DatabaseSync(config.databasePath, { readOnly: true });
  const thread = db.prepare('SELECT * FROM projection_threads WHERE thread_id = ?').get(config.threadId);
  const session = db.prepare('SELECT * FROM projection_thread_sessions WHERE thread_id = ?').get(config.threadId);
  const latestUser = db
    .prepare("SELECT text FROM projection_thread_messages WHERE thread_id = ? AND role = 'user' ORDER BY created_at DESC LIMIT 1")
    .get(config.threadId);
  const action = decision(thread, session, state, latestUser);
  const save = () => {
    mkdirSync(dirname(config.statePath), { recursive: true });
    writeFileSync(`${config.statePath}.tmp`, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    renameSync(`${config.statePath}.tmp`, config.statePath);
  };
  // --steer is an explicit one-time delivery of the user's multi-model instruction.
  const steer = process.argv.includes('--steer');
  if (action === 'stop-requested') {
    state.stopped = true;
    save();
  }
  if ((!steer && action !== 'kick') || ['inactive', 'stopped', 'stop-requested', 'waiting-for-user'].includes(action)) {
    console.log(JSON.stringify({ action, threadId: config.threadId }));
    db.close();
    return;
  }
  // Keep a command ID across ambiguous transport failures. T3 deduplicates receipts.
  if (!state.pending) {
    state.pending = {
      type: 'thread.turn.start',
      commandId: randomUUID(),
      threadId: config.threadId,
      message: {
        messageId: randomUUID(),
        role: 'user',
        attachments: [],
        text: `${marker}\n使用者要求：請重複直到未啟用的新聞平台都有抓到；停止時會重新 kick。使用者另外明確授權你使用多個模型與多個子代理，請依平台分組平行研究與修復，避免代理同時改同一檔案。延續本對話現有成果，不要重頭開始；以本對話使用者最新指示優先。\n仍須保留先前明確排除的媒體、重複代碼與已變質網域；只以真實發布時間、完整公開正文、實際入庫與站內可讀證據算成功。使用者已授權收錄最新可取得的舊文章，保留真實日期，全文從收錄日起保存 90 天；不要再以近 14 天作為阻擋條件。不得把啟用設定、摘要或失敗試抓當成功。遇到限流請退避，嘗試其他官方公開入口；不要繞過登入或付費限制。每輪更新 docs/crawl-restoration.md，記錄新增成功與剩餘來源；有程式修改請測試並提交，只提交自己的修改。\n本機監督器每分鐘檢查；仍在執行時不另開一輪。只有所有範圍內來源均有入庫全文證據才完成。完成時請先更新報告與 commit，再將 ${config.statePath} 的 stopped 設為 true，並加入 completionEvidence 說明逐站證據；保留其他欄位。若使用者要求停止，也請設 stopped=true。不要因一輪遇到外部限制就宣稱全部完成。`,
      },
      modelSelection: JSON.parse(thread.model_selection_json),
      runtimeMode: thread.runtime_mode,
      interactionMode: thread.interaction_mode,
      createdAt: new Date().toISOString(),
    };
    save();
  }
  const receipt = db.prepare('SELECT status, error FROM orchestration_command_receipts WHERE command_id = ?').get(state.pending.commandId);
  if (receipt?.error) throw new Error(`Previous dispatch failed: ${receipt.error}`);
  if (!receipt) await rpc(config.origin, readFileSync(config.tokenPath, 'utf8').trim(), 'orchestration.dispatchCommand', state.pending);
  state.lastKickAt = new Date().toISOString();
  state.kicks = (state.kicks ?? 0) + 1;
  state.lastCommandId = state.pending.commandId;
  delete state.pending;
  save();
  db.close();
  console.log(JSON.stringify({ action: steer ? 'steered' : 'kicked', threadId: config.threadId, kicks: state.kicks }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
