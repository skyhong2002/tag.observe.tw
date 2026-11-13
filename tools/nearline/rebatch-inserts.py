#!/usr/bin/env python3
"""Merge one-row INSERT statements from a site dump back into ~1 MiB statements.

Nightly dumps use --skip-extended-insert so unchanged rows stay byte-identical
for the deduplicating NAS store (#33). Replaying 32M single-row statements is
about four times slower than the old extended dump, so restores pipe the SQL
through this filter first:

    zstd -dc tag_observe-....sql.zst | python3 -I rebatch-inserts.py | mariadb ...

Only consecutive `INSERT INTO `t` VALUES (...);` lines for the same table are
merged. Every other line, including the --no-autocommit COMMIT, is passed
through unchanged and ends the current batch, so statement order is kept.
"""
import sys

LIMIT = 1 << 20
MARK = b' VALUES ('


def rebatch(lines, limit=LIMIT):
    prefix, rows, size = None, [], 0
    for line in lines:
        start = line.find(MARK) if line.startswith(b'INSERT INTO `') and line.endswith(b');\n') else -1
        if start < 0:
            if prefix is not None:
                yield prefix + b','.join(rows) + b';\n'
                prefix, rows, size = None, [], 0
            yield line
            continue
        head, row = line[:start + len(MARK) - 1], line[start + len(MARK) - 1:-2]
        if prefix is not None and (head != prefix or size + len(row) > limit):
            yield prefix + b','.join(rows) + b';\n'
            prefix, rows, size = None, [], 0
        prefix = head
        rows.append(row)
        size += len(row) + 1
    if prefix is not None:
        yield prefix + b','.join(rows) + b';\n'


def main():
    out = sys.stdout.buffer
    for chunk in rebatch(sys.stdin.buffer):
        out.write(chunk)
    out.flush()


if __name__ == '__main__':
    main()
