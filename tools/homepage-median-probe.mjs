// Read-only homepage sampling. Importing this module executes no probe.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
const execute = promisify(execFile);
const marker = '\n__TAG_GATE_METRICS__';
const capBytes = 64 * 1024;
const sha = b => createHash('sha256').update(b).digest('hex');
export const gateMeasurement = Object.freeze({
  userDecisionUTCMinute:'2026-10-13T20:47Z', trialsPerSite:3, statistic:'median time_total',
  failures:'Any HTTP other than200 or any curl/parse error rejects; latency uses median only.',
  method:'DNT:1, Accept:text/html, three sequential HTML downloads per site; sites sampled in parallel (at most three curls); no cookies, redirect following, cache-busting, JS or GA',
});
export const median3 = values => {
  if(values.length!==3||values.some(x=>!Number.isFinite(x)||x<0))throw Error('Three finite nonnegative measurements required');
  return [...values].sort((a,b)=>a-b)[1];
};
function textOf(raw,key) {
  const b=Buffer.from(raw[key+'Base64']||'','base64');
  if(b.length>capBytes||b.toString('base64')!==raw[key+'Base64']||b.length!==raw[key+'Bytes']||sha(b)!==raw[key+'Sha256'])throw Error('Original transport bytes differ');
  return b.toString('utf8');
}
export function parseHomepageTrial(raw) {
  let status=0,ttfb=null,total=null,bytes=null,cfCacheStatus=null,parseError=null;
  try{
    const out=textOf(raw,'stdout');textOf(raw,'stderr');
    const i=out.lastIndexOf(marker);if(i<0)throw Error('Missing curl metrics');
    const metrics=JSON.parse(out.slice(i+marker.length).trim());
    status=typeof metrics.http_code==='string'&&/^\d{3}$/.test(metrics.http_code)?Number(metrics.http_code):metrics.http_code;ttfb=metrics.time_starttransfer;total=metrics.time_total;bytes=metrics.size_download;
    if(!Number.isInteger(status)||status<0||status>599||!Number.isFinite(ttfb)||ttfb<0||!Number.isFinite(total)||total<ttfb||!Number.isSafeInteger(bytes)||bytes<0)throw Error('Invalid curl metrics');
    const blocks=out.slice(0,i).split(/\r?\n\r?\n/).filter(x=>/^HTTP\/\S+\s+\d{3}(?:\s|$)/.test(x));
    const header=blocks.at(-1);if(status!==0&&(!header||Number(/^HTTP\/\S+\s+(\d{3})/.exec(header)[1])!==status))throw Error('Final status/header differs');
    const matches=[...(header||'').matchAll(/^cf-cache-status:[ \t]*([^\r\n]*)/gmi)];
    if(matches.length>1)throw Error('Ambiguous cache status');
    cfCacheStatus=matches.length?matches[0][1].trim():null;if(cfCacheStatus?.length>512)throw Error('Oversized cache status');
  }catch{parseError='malformed-or-incomplete-curl-receipt';}
  return {index:raw.index,startedAtMs:raw.startedAtMs,endedAtMs:raw.endedAtMs,exitCode:raw.exitCode,status,ttfb,total,bytes,cfCacheStatus,parseError,rawSha256:sha(JSON.stringify(raw)),raw};
}
export function summarizeHomepageTrials(url,trials) {
  const usable=trials.length===3&&trials.every(t=>t.parseError===null&&t.exitCode===0&&t.status===200);
  return {schema:'homepage-three-trial-median-v1',url,trials,
    startedAtMs:Math.min(...trials.map(t=>t.startedAtMs)),endedAtMs:Math.max(...trials.map(t=>t.endedAtMs)),
    status:usable?200:(trials.find(t=>t.status!==200)?.status??200),exitCode:usable?0:(trials.find(t=>t.exitCode!==0)?.exitCode??0),
    total:usable?median3(trials.map(t=>t.total)):null,ttfb:usable?median3(trials.map(t=>t.ttfb)):null};
}
function requireTrial(t,index,{startedAtMs=-Infinity,endedAtMs=Infinity}={}) {
  if(t?.index!==index||t.exitCode!==0||t.status!==200||t.parseError!==null||!Number.isFinite(t.startedAtMs)||!Number.isFinite(t.endedAtMs)||
    t.startedAtMs>t.endedAtMs||t.startedAtMs<startedAtMs||t.endedAtMs>endedAtMs||!Number.isFinite(t.ttfb)||t.ttfb<0||!Number.isFinite(t.total)||t.total<t.ttfb||
    !Number.isSafeInteger(t.bytes)||t.bytes<0||!(t.cfCacheStatus===null||typeof t.cfCacheStatus==='string'&&t.cfCacheStatus.length<=512)||
    !/^[a-f0-9]{64}$/.test(t.rawSha256||'')||!t.raw||t.raw.type!=='homepage-trial-raw'||t.raw.transportError!==null)throw Error('Each original HTTP200/curl0 trial is mandatory');
  const parsed=parseHomepageTrial(t.raw);
  for(const key of ['index','startedAtMs','endedAtMs','exitCode','status','ttfb','total','bytes','cfCacheStatus','parseError','rawSha256'])
    if(parsed[key]!==t[key])throw Error('Parsed trial differs from original receipt');
}
export function requireHomepageMedian(row,limit,bounds={}) {
  if(row?.schema!=='homepage-three-trial-median-v1'||!Array.isArray(row.trials)||row.trials.length!==3||row.status!==200||row.exitCode!==0||!Number.isFinite(limit)||limit<0)throw Error('Exactly three original trials required');
  row.trials.forEach((t,i)=>{if(t.raw?.url!==row.url)throw Error('Original sample belongs to another site');requireTrial(t,i+1,bounds);});
  if(row.trials.some((t,i)=>i&&t.startedAtMs<row.trials[i-1].endedAtMs)||row.startedAtMs!==row.trials[0].startedAtMs||row.endedAtMs!==row.trials[2].endedAtMs||
    row.total!==median3(row.trials.map(t=>t.total))||row.ttfb!==median3(row.trials.map(t=>t.ttfb))||row.total>limit)throw Error('Median/timing exceeds or disagrees with original trials');
  return row;
}
export async function collectHomepageTrials({urls,executeCommand=execute,record=()=>{},now=Date.now}={}) {
  if(!Array.isArray(urls)||urls.length!==3||new Set(urls).size!==3||urls.some(u=>{try{return new URL(u).protocol!=='https:';}catch{return true;}}))throw Error('Exactly three HTTPS homepage URLs required');
  let failure;
  const emit=row=>{try{const r=record(row);if(r?.then)Promise.resolve(r).catch(()=>{});if(r===false||r?.then)throw Error('Synchronous durable probe receipt required');}catch(e){failure??=e;throw e;}};
  const settled=await Promise.allSettled(urls.map(async url=>{
    const trials=[];
    for(let index=1;index<=3;index++){
      if(failure)break;
      const startedAtMs=now();let response,exitCode=0,transportError=null;
      try{response=await executeCommand('/usr/bin/curl',['-sS','-H','DNT: 1','-H','Accept: text/html','--max-time','10','-D','-','-o','/dev/null','-w',marker+'{"http_code":"%{http_code}","time_starttransfer":%{time_starttransfer},"time_total":%{time_total},"size_download":%{size_download}}\n',url],{encoding:null,timeout:12000,maxBuffer:capBytes,env:{PATH:'/usr/bin:/bin',LANG:'C'}});}
      catch(e){response=e;exitCode=Number.isInteger(e.code)?e.code:null;transportError=typeof e.code==='string'?e.code:'curl-failed';}
      const stdout=Buffer.from(response.stdout||''),stderr=Buffer.from(response.stderr||'');
      const raw={type:'homepage-trial-raw',url,index,startedAtMs,endedAtMs:now(),exitCode,transportError,
        stdoutBase64:stdout.toString('base64'),stderrBase64:stderr.toString('base64'),stdoutBytes:stdout.length,stderrBytes:stderr.length,stdoutSha256:sha(stdout),stderrSha256:sha(stderr)};
      emit(raw); // Original stdout/stderr/exit/timing is durable before parsing or verdict.
      const trial=parseHomepageTrial(raw);trials.push(trial);emit({type:'homepage-trial',url,index,sample:trial});
    }
    return summarizeHomepageTrials(url,trials);
  }));
  if(failure)throw failure;
  const rejected=settled.find(r=>r.status==='rejected');if(rejected)throw rejected.reason;
  return settled.map(r=>r.value);
}
