"""Read-only MySQL exporter, sent over SSH stdin. Compatible with Python 2.7."""
from __future__ import print_function
import base64
import hashlib
import json
import subprocess
import sys
import tempfile
import zlib

PREFIX = 'NEARLINE1:'


def emit(obj):
    sys.stdout.write(PREFIX + json.dumps(obj) + '\n')
    sys.stdout.flush()


def ident(value):
    return '`' + value.replace('`', '``') + '`'


def literal(value):
    return "'" + value.replace('\\', '\\\\').replace("'", "''") + "'"


def query(sql):
    cmd = ['mysql', '--batch', '--raw', '--skip-column-names',
           '--default-character-set=utf8mb4', '--connect-timeout=10',
           '-e', 'SET SESSION lock_wait_timeout=5; ' + sql]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out, err = p.communicate()
    if p.returncode:
        raise RuntimeError(err.decode('utf8', 'replace')[-2000:])
    return [line.split('\t') for line in out.decode('utf8').splitlines()]


def main(request):
    db = request['database']
    action = request['action']
    if action == 'inventory':
        tables = query('SELECT TABLE_NAME,ENGINE,TABLE_ROWS,DATA_LENGTH,INDEX_LENGTH '
                       'FROM information_schema.tables WHERE TABLE_SCHEMA=' + literal(db) + ' ORDER BY TABLE_NAME')
        keys = query("SELECT s.TABLE_NAME,s.COLUMN_NAME,c.DATA_TYPE FROM information_schema.statistics s "
                     "JOIN information_schema.columns c ON c.TABLE_SCHEMA=s.TABLE_SCHEMA AND c.TABLE_NAME=s.TABLE_NAME "
                     "AND c.COLUMN_NAME=s.COLUMN_NAME WHERE s.TABLE_SCHEMA=" + literal(db) +
                     " AND s.INDEX_NAME='PRIMARY' ORDER BY s.TABLE_NAME,s.SEQ_IN_INDEX")
        emit({'type': 'result', 'tables': tables, 'keys': keys,
              'server': query("SELECT VERSION(),@@log_bin,@@binlog_format")})
        return
    table = request.get('table')
    full = ident(db) + '.' + ident(table) if table else None
    if action == 'bounds':
        pk = ident(request['pk'])
        rows = query('SELECT ' + pk + ' FROM ' + full + ' ORDER BY ' + pk + ' DESC LIMIT 1')
        emit({'type': 'result', 'maximum': int(rows[0][0]) if rows else None})
        return
    if action == 'boundary':
        pk = ident(request['pk'])
        where = pk + '<=' + str(int(request['maximum']))
        if request['after'] is not None:
            where += ' AND ' + pk + '>' + str(int(request['after']))
        # Keyset scan; each request visits at most chunk_rows entries in the primary index.
        rows = query('SELECT ' + pk + ' FROM ' + full + ' WHERE ' + where +
                     ' ORDER BY ' + pk + ' LIMIT ' + str(int(request['chunk_rows']) - 1) + ',1')
        emit({'type': 'result', 'upper': int(rows[0][0]) if rows else request['maximum']})
        return
    args = ['nice', '-n', '10', 'mysqldump', '--quick', '--skip-lock-tables',
            '--hex-blob', '--default-character-set=utf8mb4', '--set-gtid-purged=OFF',
            '--skip-comments', '--skip-dump-date', '--max-allowed-packet=256M']
    if action == 'schema':
        args += ['--no-data', '--skip-triggers', db, table]
    elif action == 'programs':
        args += ['--no-data', '--no-create-info', '--routines', '--events', '--triggers']
        args += ['--ignore-table=' + db + '.' + t for t in request.get('exclude', [])]
        args += [db]
    elif action == 'data':
        args += ['--no-create-info', '--skip-triggers', '--skip-add-locks',
                 '--skip-disable-keys', '--complete-insert', '--order-by-primary']
        if request.get('pk'):
            pk = ident(request['pk'])
            where = pk + '<=' + str(int(request['upper']))
            if request['after'] is not None:
                where += ' AND ' + pk + '>' + str(int(request['after']))
            args += ['--where=' + where]
        args += [db, table]
    else:
        raise ValueError('Unknown action')
    compressor = zlib.compressobj(3, zlib.DEFLATED, 31)
    digest = hashlib.sha256()
    total = 0
    p = None
    with tempfile.TemporaryFile() as errors:
        try:
            p = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=errors)
            while True:
                data = p.stdout.read(65536)
                if not data:
                    break
                total += len(data)
                if total > request['max_raw_bytes']:
                    raise RuntimeError('RAW_LIMIT: chunk exceeds uncompressed size budget')
                packed = compressor.compress(data)
                if packed:
                    digest.update(packed)
                    emit({'type': 'data', 'base64': base64.b64encode(packed).decode('ascii')})
            if p.wait():
                errors.seek(0)
                raise RuntimeError(errors.read().decode('utf8', 'replace')[-2000:])
            packed = compressor.flush()
            digest.update(packed)
            emit({'type': 'data', 'base64': base64.b64encode(packed).decode('ascii')})
            emit({'type': 'end', 'sha256': digest.hexdigest(), 'raw_bytes': total})
        finally:
            if p is not None and p.poll() is None:
                p.terminate()
                p.wait()


try:
    main(REQUEST)
except Exception as error:
    emit({'type': 'error', 'message': str(error)})
    sys.exit(1)
