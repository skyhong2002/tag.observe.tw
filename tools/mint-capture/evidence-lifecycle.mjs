// Every asynchronous evidence callback is owned, drained and reflected in verdict.
export function evidenceTasks(onFailure = () => {}) {
  const pending = new Set();
  let failure;
  return {
    add(task) {
      const promise = Promise.resolve()
        .then(task)
        .catch((error) => {
          failure ??= error;
          onFailure(error);
        })
        .finally(() => pending.delete(promise));
      pending.add(promise);
      return promise;
    },
    async drain() {
      while (pending.size) await Promise.all([...pending]);
      if (failure) throw failure;
    },
    get failure() {
      return failure;
    },
  };
}
export function requireCaptureEvidence({ proxy, files, cleanupErrors = [] }) {
  if (proxy?.failed || proxy?.stats?.googleOutgoing !== 0) throw Error('Proxy evidence failed or Google outgoing was observed');
  if (cleanupErrors.length) throw Error('Capture cleanup/evidence flush failed: ' + String(cleanupErrors[0].message).slice(0, 256));
  for (const name of ['requests.raw.jsonl', 'network.har', 'prelaunch-proxy.jsonl', 'browser-owner.jsonl', 'browser-watchdog.jsonl'])
    if (!files.includes(name)) throw Error('Missing mandatory capture evidence: ' + name);
  return true;
}
export function validateNetworkEvidence({ files, read, stats }) {
  const rows = (name) => {
    const text = read(name).toString();
    if (!text.trim()) throw Error('Empty mandatory evidence: ' + name);
    return text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
  };
  for (const name of files) if (name.endsWith('.jsonl')) rows(name);
  const har = JSON.parse(read('network.har'));
  if (!Array.isArray(har?.log?.entries) || !har.log.entries.length || har.log.entries.length > 5000)
    throw Error('No bounded actual HAR request evidence');
  const requests = rows('requests.raw.jsonl');
  if (!requests.some((r) => r.event === 'request') || !requests.some((r) => r.event === 'response'))
    throw Error('Original requests/responses missing');
  const proxy = rows('prelaunch-proxy.jsonl');
  if (
    !stats ||
    !Number.isInteger(stats.admitted) ||
    stats.admitted < 1 ||
    !Number.isInteger(stats.blocked) ||
    stats.blocked < 0 ||
    stats.googleOutgoing !== 0 ||
    proxy.filter((r) => r.event === 'admitted').length !== stats.admitted ||
    proxy.filter((r) => r.event === 'denied').length !== stats.blocked
  )
    throw Error('Proxy counters cannot be recomputed from original evidence');
  return true;
}
