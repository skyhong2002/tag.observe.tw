// Synthetic in-memory test data only; no network, file or process operations.
import {createHash} from 'node:crypto';
import {parseHomepageTrial,summarizeHomepageTrials} from '../homepage-median-probe.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function curlStdoutFixture({status=200,total=.5,ttfb=.1,bytes=1234,cfCacheStatus='HIT'}={}) {
  return `HTTP/2 ${status}\r\n${cfCacheStatus===null?'':`cf-cache-status: ${cfCacheStatus}\r\n`}\r\n\n__TAG_GATE_METRICS__${JSON.stringify({http_code:status,time_starttransfer:ttfb,time_total:total,size_download:bytes})}\n`;
}
export function homepageSiteFixture(url,totals=[.5,.5,.5],{startedAtMs=1,patches=[]}={}) {
  return summarizeHomepageTrials(url,totals.map((total,i)=>{
    const p=patches[i]||{},stdout=Buffer.from(curlStdoutFixture({total,...p})),stderr=Buffer.from(p.stderr||'');
    return parseHomepageTrial({type:'homepage-trial-raw',url,index:i+1,startedAtMs,endedAtMs:startedAtMs,
      exitCode:p.exitCode??0,transportError:p.transportError??null,stdoutBase64:stdout.toString('base64'),stderrBase64:stderr.toString('base64'),stdoutBytes:stdout.length,stderrBytes:stderr.length,stdoutSha256:sha(stdout),stderrSha256:sha(stderr)});
  }));
}
