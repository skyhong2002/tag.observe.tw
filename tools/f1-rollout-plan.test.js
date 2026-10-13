import test from 'node:test';
import assert from 'node:assert/strict';
import { routeCommands, runtimeCommands, validBuildOrigin, image } from './f1-rollout-plan.js';
const sha = 'ae9e18e581ec274b756995edbfe3c8cb9533ee5b';
test('existing isolated build origin 18170 is accepted, production and nonlocal origins rejected', () => {
  assert.equal(validBuildOrigin('http://127.0.0.1:18170'), true);
  for (const value of ['http://127.0.0.1:18130', 'http://tag.observe.tw:18170', 'https://127.0.0.1:18170', 'http://user:pass@127.0.0.1:18170', 'http://127.0.0.1:18170/path']) assert.equal(validBuildOrigin(value), false);
});
test('route commands preserve exact scoped rule and root host capabilities', () => {
  const rule = ['OUTPUT','-p','tcp','-d','127.0.0.1/32','--dport','18130','-m','comment','--comment',`tag-f1-${sha}`,'-j','REDIRECT','--to-ports','18194'];
  const prefix = ['docker','run','--rm','--pull=never','--user','0:0','--network','host','--cap-add','NET_ADMIN','--cap-add','SYS_CHROOT','--mount','type=bind,src=/,dst=/host,readonly','--entrypoint','/usr/sbin/chroot',image,'/host','/usr/sbin/iptables','-w','5','-t','nat'];
  assert.deepEqual(routeCommands(sha), {check:[...prefix,'-C',...rule],switch:[...prefix,'-I','OUTPUT','1',...rule.slice(1)],rollback:[...prefix,'-D',...rule]});
  assert.throws(() => routeCommands('short'));
});
test('runtime configuration uses same candidate and overrides isolated build API', () => {
  const commands = runtimeCommands({sha,candidate:'/candidate',standaloneWeb:'/candidate/web/.next/standalone/web',envFile:'/private/.env'});
  assert.ok(commands.web.includes('--setenv=TAG_API_ORIGIN=http://127.0.0.1:18194'));
  assert.ok(commands.gateway.includes('--setenv=UI_ORIGIN=http://127.0.0.1:18192'));
  assert.ok(commands.gateway.includes('--property=EnvironmentFile=/private/.env'));
  assert.ok(commands.worker.includes('--setenv=WORKER_METRICS_PORT=18195'));
  for (const args of Object.values(commands)) assert.ok(args.some(x => x.startsWith('--unit=tag-f1-ae9e18e581ec-')));
});
