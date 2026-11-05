#!/usr/bin/python3
"""Three fixed anonymous GETs; bounded metadata only. No retries or recovery actions."""
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import http.client
import json
import math
import os
from pathlib import Path
import pwd
import signal
import ssl
import stat
import sys
import time
import urllib.error
import urllib.request

ENDPOINTS = (('public', 'https://tag.observe.tw/'),
             ('web', 'http://127.0.0.1:18332/'),
             ('gateway', 'http://127.0.0.1:18130/'))
# The account's real home from the password database, not a hard-coded legacy
# alias: /home/deck became a symlink to /home/sky after the sky-server move,
# and Store deliberately refuses to traverse symlinked components.
STATE = Path(pwd.getpwuid(os.getuid()).pw_dir) / '.local' / 'state' / 'tag-availability-monitor'
CAP = 2 * 1024 * 1024
MAX_STATE = 4096
REQUEST_SECONDS = 3.0
ROUND_SECONDS = 12.0
REASONS = ('ok', 'timeout', 'network', 'http_status', 'redirect', 'response_limit', 'invalid_response', 'not_run')


@contextmanager
def deadline(seconds):
    """POSIX absolute alarm, preserving an enclosing deadline without extending it."""
    if not math.isfinite(seconds) or seconds <= 0:
        raise TimeoutError()
    started = time.monotonic()
    old_handler = signal.getsignal(signal.SIGALRM)
    previous = signal.getitimer(signal.ITIMER_REAL)
    if previous[1]:
        raise ValueError('periodic_timer_unsupported')
    def expired(_number, _frame):
        raise TimeoutError()
    signal.signal(signal.SIGALRM, expired)
    signal.setitimer(signal.ITIMER_REAL, min(seconds, previous[0]) if previous[0] else seconds)
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, old_handler)
        if previous[0]:
            # An elapsed outer deadline must fire promptly, never be cancelled.
            signal.setitimer(signal.ITIMER_REAL, max(0.000001, previous[0] - (time.monotonic() - started)))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        return None


def new_opener():
    return urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect(),
        urllib.request.HTTPSHandler(context=ssl.create_default_context()))


def empty_row(name):
    return {'endpoint': name, 'http_status': None, 'elapsed_seconds': 0.0,
            'bytes': 0, 'timeout': False, 'result': 'not_run', 'response_complete': False}


def probe(name, url, *, opener=None, clock=time.monotonic, guard=deadline):
    # No configurable URL, proxy, credentials, redirects, cookies or fallback.
    if (name, url) not in ENDPOINTS:
        raise ValueError('endpoint_unreviewed')
    started = clock()
    row = empty_row(name)
    try:
        with guard(REQUEST_SECONDS):
            client = new_opener() if opener is None else opener
            request = urllib.request.Request(url, method='GET', headers={
                'Host': 'tag.observe.tw', 'DNT': '1', 'Accept': 'text/html',
                'Accept-Encoding': 'identity', 'User-Agent': 'tag-availability-monitor/1.0'})
            try:
                response = client.open(request, timeout=REQUEST_SECONDS)
            except urllib.error.HTTPError as error:
                response = error
            with response:
                status = response.status
                if type(status) is not int or not 100 <= status <= 599 or response.geturl() != url:
                    row['result'] = 'invalid_response'
                else:
                    row['http_status'] = status
                    if 300 <= status <= 399:
                        row['result'] = 'redirect'  # Do not consume or follow a redirect.
                    else:
                        while True:
                            if clock() - started >= REQUEST_SECONDS:
                                raise TimeoutError()
                            # Stop at the cap, without reading a sentinel byte past it.
                            # Exact-cap responses are conservatively incomplete.
                            chunk = response.read(min(65536, CAP - row['bytes']))
                            if type(chunk) is not bytes:
                                raise http.client.HTTPException()
                            row['bytes'] += len(chunk)
                            if row['bytes'] >= CAP:
                                row['result'] = 'response_limit'
                                break
                            if not chunk:
                                # Sized stdlib reads can silently EOF with declared
                                # Content-Length still remaining. Framing may veto
                                # completion; it never substitutes for bounded reads.
                                remaining = getattr(response, 'length', None)
                                if remaining is not None and (type(remaining) is not int or remaining != 0):
                                    raise http.client.HTTPException()
                                row['response_complete'] = True
                                row['result'] = 'ok' if 200 <= status <= 299 else 'http_status'
                                break
    except TimeoutError:
        row.update(result='timeout', timeout=True, response_complete=False)
    except urllib.error.URLError as error:
        timed_out = isinstance(error.reason, TimeoutError)
        row.update(result='timeout' if timed_out else 'network', timeout=timed_out)
    except http.client.HTTPException:
        row['result'] = 'invalid_response'
    except (OSError, ValueError):
        row['result'] = 'network'
    row['elapsed_seconds'] = round(max(0.0, clock() - started), 6)
    # Every response classification remains subject to the absolute deadline.
    if row['elapsed_seconds'] >= REQUEST_SECONDS:
        row.update(result='timeout', timeout=True, response_complete=False)
    return row


def collect(*, run_probe=probe, clock=time.monotonic, wall=lambda: datetime.now(timezone.utc)):
    started = clock()
    rows = []
    for name, url in ENDPOINTS:
        if clock() - started >= ROUND_SECONDS:
            rows.append(empty_row(name))
        else:
            rows.append(run_probe(name, url))
    result = {'schema': 'tag-availability-v1', 'observed_at': wall().isoformat(), 'probes': rows}
    validate(result)
    return result


def validate(result):
    if type(result) is not dict or set(result) != {'schema', 'observed_at', 'probes'} or result['schema'] != 'tag-availability-v1':
        raise ValueError('schema')
    if type(result['observed_at']) is not str or len(result['observed_at']) > 40:
        raise ValueError('timestamp')
    timestamp = datetime.fromisoformat(result['observed_at'])
    if timestamp.tzinfo is None or timestamp.utcoffset() is None:
        raise ValueError('timestamp')
    rows = result['probes']
    if type(rows) is not list or len(rows) != 3:
        raise ValueError('probe_count')
    keys = set(empty_row('public'))
    for row, (name, _) in zip(rows, ENDPOINTS):
        if type(row) is not dict or set(row) != keys or row['endpoint'] != name or row['result'] not in REASONS:
            raise ValueError('probe_schema')
        status, elapsed, size = row['http_status'], row['elapsed_seconds'], row['bytes']
        if (status is not None and (type(status) is not int or not 100 <= status <= 599)) or (
            type(elapsed) not in (int, float) or not math.isfinite(elapsed) or not 0 <= elapsed <= ROUND_SECONDS) or (
            type(size) is not int or not 0 <= size <= CAP) or type(row['timeout']) is not bool or type(row['response_complete']) is not bool:
            raise ValueError('probe_values')
        if row['timeout'] != (row['result'] == 'timeout'):
            raise ValueError('timeout_consistency')
        if row['result'] in ('ok', 'http_status') and not row['response_complete']:
            raise ValueError('completion')
        if row['response_complete'] and row['result'] not in ('ok', 'http_status'):
            raise ValueError('completion')
        if row['result'] == 'ok' and (status is None or not 200 <= status <= 299 or elapsed >= REQUEST_SECONDS):
            raise ValueError('success')
        if row['result'] == 'redirect' and (status is None or not 300 <= status <= 399 or size != 0):
            raise ValueError('redirect')
        if row['result'] == 'http_status' and (status is None or 200 <= status <= 399):
            raise ValueError('status')
        if row['result'] == 'response_limit' and size != CAP:
            raise ValueError('response_limit')
        if row['result'] == 'not_run' and row != empty_row(name):
            raise ValueError('not_run')
    return result


def is_fresh(result, now, max_age=600):
    try:
        validate(result)
        if now.tzinfo is None:
            return False
        age = (now - datetime.fromisoformat(result['observed_at'])).total_seconds()
        return 0 <= age <= max_age
    except (ValueError, TypeError, KeyError, OverflowError):
        return False


class Store:
    """Dedicated0700 directory,0600 files, no-follow dirfds and twelve fixed history slots."""
    def __init__(self, directory):
        path = Path(directory)
        if not path.is_absolute() or '..' in path.parts or not path.is_relative_to('/home'):
            raise ValueError('state_path')
        self.directory_fd = self.lock_fd = None
        fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
        try:
            for index, component in enumerate(path.parts[1:]):
                if index == len(path.parts) - 2:
                    try:
                        os.mkdir(component, 0o700, dir_fd=fd)
                    except FileExistsError:
                        pass
                next_fd = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=fd)
                os.close(fd); fd = next_fd
            info = os.fstat(fd)
            if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
                raise ValueError('state_permissions')
            self.directory_fd = fd; fd = None
            self.lock_fd = os.open('.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC,
                                   0o600, dir_fd=self.directory_fd)
            self.check_file(os.fstat(self.lock_fd))
            fcntl.flock(self.lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BaseException:
            self.close(); raise
        finally:
            if fd is not None:
                os.close(fd)

    @staticmethod
    def check_file(info):
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o600 or info.st_nlink != 1:
            raise ValueError('state_file_permissions')

    def close(self):
        for name in ('lock_fd', 'directory_fd'):
            fd = getattr(self, name, None)
            if fd is not None:
                os.close(fd); setattr(self, name, None)

    def _atomic(self, name, payload):
        try:
            self.check_file(os.stat(name, dir_fd=self.directory_fd, follow_symlinks=False))
        except FileNotFoundError:
            pass
        fd = os.open('.atomic.tmp', os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC,
                     0o600, dir_fd=self.directory_fd)
        checked = False
        try:
            self.check_file(os.fstat(fd)); checked = True
            os.ftruncate(fd, 0)
            with os.fdopen(fd, 'wb') as output:
                fd = None
                output.write(payload); output.flush(); os.fsync(output.fileno())
            os.replace('.atomic.tmp', name, src_dir_fd=self.directory_fd, dst_dir_fd=self.directory_fd)
            os.fsync(self.directory_fd)
        finally:
            if fd is not None:
                os.close(fd)
            if checked:
                try:
                    os.unlink('.atomic.tmp', dir_fd=self.directory_fd)
                except FileNotFoundError:
                    pass

    def write(self, result):
        validate(result)
        payload = (json.dumps(result, allow_nan=False, separators=(',', ':')) + '\n').encode('ascii')
        if len(payload) > MAX_STATE:
            raise ValueError('state_limit')
        slot = int(datetime.fromisoformat(result['observed_at']).timestamp() // 300) % 12
        # History first: a history failure never presents a new latest as fully settled.
        self._atomic('history-%02d.json' % slot, payload)
        self._atomic('latest.json', payload)


def main():
    os.umask(0o077)
    with deadline(ROUND_SECONDS):
        store = Store(STATE)
        try:
            result = collect()
            store.write(result)
            return 0 if all(row['result'] == 'ok' for row in result['probes']) else 1
        finally:
            store.close()


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, TimeoutError):
        # No raw exception, URL, header, body, environment or per-request journal output.
        raise SystemExit(2)
