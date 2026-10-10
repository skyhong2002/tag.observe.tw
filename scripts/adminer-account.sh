#!/usr/bin/env bash
# Gives a site admin their own MariaDB account for /admin/db/ (docs/login.md),
# or takes it away. The password lives only in infra/.env (TAG_ADMINER_ACCOUNTS),
# which Adminer reads; the admin never types it.
#
#   scripts/adminer-account.sh <email>            read-only (SELECT, SHOW VIEW)
#   scripts/adminer-account.sh <email> --write    also INSERT, UPDATE, DELETE
#   scripts/adminer-account.sh <email> --revoke   drop the account
#
# Running it again for the same email rotates the password and resets grants.
# Afterwards recreate Adminer so it sees the new list:
#   cd infra && docker compose up -d --no-deps adminer
set -euo pipefail

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
infra_env="$root/infra/.env"
app_env="$root/.env"
email=$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')
mode=${2:-read}
case "$mode" in read | --write | --revoke) ;; *) email= ;; esac
if [[ ! "$email" =~ ^[^@[:space:],=]+@[^@[:space:],=]+$ ]]; then
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
fi

local_part=$(printf '%s' "${email%@*}" | tr -c 'a-z0-9_\n' '_')
user="adm_${local_part:0:28}"
password=$(openssl rand -hex 24)
root_password=$(sed -n 's/^TAG_DB_ROOT_PASSWORD=//p' "$infra_env" | tail -1)
[ -n "$root_password" ] || { echo "TAG_DB_ROOT_PASSWORD missing from $infra_env" >&2; exit 1; }

if [ "$mode" = --revoke ]; then
  sql="DROP USER IF EXISTS '$user'@'%';"
else
  grants='SELECT, SHOW VIEW'
  [ "$mode" = --write ] && grants="$grants, INSERT, UPDATE, DELETE"
  sql="CREATE USER IF NOT EXISTS '$user'@'%' IDENTIFIED BY '$password';
ALTER USER '$user'@'%' IDENTIFIED BY '$password';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM '$user'@'%';
GRANT $grants ON tag_observe.* TO '$user'@'%';"
fi
printf '%s\n' "$sql" | docker exec -i -e MYSQL_PWD="$root_password" tag-db mariadb -uroot

# Update TAG_ADMINER_ACCOUNTS (email=user:password,...) in infra/.env, and make
# sure both env files carry the same TAG_ADMINER_SECRET.
EMAIL="$email" USER_NAME="$user" PASSWORD="$password" MODE="$mode" python3 -I - "$infra_env" "$app_env" <<'PY'
import os, secrets, sys

def read(path):
    with open(path) as f:
        return f.read().splitlines()

def value(lines, key):
    found = [line.split('=', 1)[1] for line in lines if line.startswith(key + '=')]
    return found[-1] if found else None

def put(lines, key, val):
    out = [line for line in lines if not line.startswith(key + '=')]
    return out + [f'{key}={val}'] if val is not None else out

def write(path, lines):
    tmp = path + '.tmp'
    with open(os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), 'w') as f:
        f.write('\n'.join(lines) + '\n')
    os.replace(tmp, path)

infra_path, app_path = sys.argv[1:3]
infra, app = read(infra_path), read(app_path)
email = os.environ['EMAIL']
entries = [e for e in (value(infra, 'TAG_ADMINER_ACCOUNTS') or '').split(',') if e and e.split('=', 1)[0] != email]
if os.environ['MODE'] != '--revoke':
    entries.append(f"{email}={os.environ['USER_NAME']}:{os.environ['PASSWORD']}")
infra = put(infra, 'TAG_ADMINER_ACCOUNTS', ','.join(entries) or None)
secret = value(infra, 'TAG_ADMINER_SECRET') or value(app, 'TAG_ADMINER_SECRET') or secrets.token_hex(32)
infra = put(infra, 'TAG_ADMINER_SECRET', secret)
write(infra_path, infra)
if value(app, 'TAG_ADMINER_SECRET') != secret:
    write(app_path, put(app, 'TAG_ADMINER_SECRET', secret))
    print('TAG_ADMINER_SECRET changed in .env: restart the gateway (systemctl --user restart tag-analysis).')
PY

if [ "$mode" = --revoke ]; then echo "Dropped $user ($email)."; else echo "$user ($email): ${mode#--} access to tag_observe."; fi
echo 'Now: cd infra && docker compose up -d --no-deps adminer'
