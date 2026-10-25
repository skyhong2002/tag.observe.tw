#!/usr/bin/env bash
set -euo pipefail
umask 077
root=/home/deck/.local/share/tag-analysis
base=6d52a1626374391aea80073d92c7f8fd95d978e3
target=fdf8b8bf50443db57eccd384c79c730eb4d2a528
node=/home/deck/.local/bin/node
release="$root/releases/$target"
exec 9>"$root/deploy.lock"
flock -n 9 || { echo 'Another deployment owns the lock.' >&2; exit 1; }
old=$(readlink -f "$root/current")
[[ $(cat "$old/COMMIT") == "$base" ]] || { echo 'Active source changed; inspect again.' >&2; exit 1; }
(cd "$old" && sha256sum -c /tmp/live-account-api-base.sha256)
[[ ! -e "$release" ]] || { echo 'Target release already exists; inspect before retry.' >&2; exit 1; }
web_pid=$(systemctl --user show tag-web.service -p MainPID --value)
worker_pid=$(systemctl --user show tag-worker.service -p MainPID --value)
stage=$(mktemp -d "$root/releases/.live-account-$target-XXXXXX")
# Hardlink immutable files, but replace changed paths by unlinking first. Directories
# are independent; no old release files or modes are changed.
cp -al -- "$old/." "$stage/"
chmod u+w "$stage" "$stage/app/src/auth" "$stage/app/src/reader"
files=(app/src/auth/account-cors.ts app/src/auth/google-login.ts app/src/reader/live-observe.ts app/src/reader/prefs-store.ts app/src/reader/routes.ts app/src/reader/validate.ts)
for file in "${files[@]}"; do rm -f -- "$stage/$file"; done
tar -xf /tmp/live-account-api-fdf8b8b.tar -C "$stage"
rm -- "$stage/COMMIT"
printf '%s\n' "$target" > "$stage/COMMIT"
printf 'Base: %s\nScope: gateway account routes only; web and dependencies reused unchanged.\n' "$base" > "$stage/ACCOUNT-RELEASE"
(cd "$stage" && sha256sum -c /tmp/live-account-api-new.sha256)
"$node" /tmp/live-account-release-smoke.mjs "$stage"
for file in "${files[@]}" COMMIT ACCOUNT-RELEASE; do chmod a-w "$stage/$file"; done
chmod a-w "$stage" "$stage/app" "$stage/app/src" "$stage/app/src/auth" "$stage/app/src/reader"
mv -- "$stage" "$release"
switched=0
rollback() {
  code=$?
  trap - EXIT
  if [[ $code -ne 0 && $switched == 1 ]]; then
    echo 'Gateway verification failed; restoring previous release.' >&2
    ln -s "$old" "$root/.current-account-rollback-$$"
    mv -Tf "$root/.current-account-rollback-$$" "$root/current"
    systemctl --user restart tag-analysis.service
  fi
  exit "$code"
}
trap rollback EXIT
ln -s "$release" "$root/.current-account-$$"
mv -Tf "$root/.current-account-$$" "$root/current"
switched=1
systemctl --user restart tag-analysis.service
"$node" --input-type=module <<'JS'
import assert from 'node:assert/strict';
const base='http://127.0.0.1:18130', origin='https://live.observe.tw';
let ready=false;
for(let i=0;i<25;i++) {
 try { const r=await fetch(base+'/_migration/health',{signal:AbortSignal.timeout(1500)});if(r.ok){ready=true;break;} } catch {}
 await new Promise(r=>setTimeout(r,1000));
}
assert.ok(ready,'Gateway readiness');
for(const [path,method,headers,status] of [
 ['/auth/me','GET',{Origin:origin},200],
 ['/auth/me/live-observe','OPTIONS',{Origin:origin,'Access-Control-Request-Method':'PUT','Access-Control-Request-Headers':'content-type'},204],
 ['/auth/me/live-observe','GET',{Origin:origin},401],
 ['/auth/me/live-observe','PUT',{Origin:origin,'Content-Type':'application/json'},401],
 ['/auth/me/live-observe','PUT',{Origin:'https://evil.test','Content-Type':'application/json'},403],
 ['/auth/me/live-observe','OPTIONS',{Origin:'https://evil.test','Access-Control-Request-Method':'PUT'},403],
 ['/auth/me/prefs','GET',{},401],
 ['/','GET',{},200],
]) {
 const r=await fetch(base+path,{method,headers,...(method==='PUT'?{body:'{}'}:{}) ,signal:AbortSignal.timeout(10000)});
 assert.equal(r.status,status,`${method} ${path}`);
 if(headers.Origin===origin){assert.equal(r.headers.get('access-control-allow-origin'),origin);assert.equal(r.headers.get('access-control-allow-credentials'),'true');}
 else assert.equal(r.headers.get('access-control-allow-origin'),null);
 console.log(method,path,r.status);
}
JS
[[ $(systemctl --user show tag-web.service -p MainPID --value) == "$web_pid" ]]
[[ $(systemctl --user show tag-worker.service -p MainPID --value) == "$worker_pid" ]]
systemctl --user is-active tag-analysis.service tag-web.service tag-worker.service
printf 'Deployed gateway %s; frontend and worker processes unchanged.\n' "$target"
