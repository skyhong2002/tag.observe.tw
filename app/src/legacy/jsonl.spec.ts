import { Readable } from 'node:stream';
import { expect, it } from 'vitest';
import { jsonLines } from './jsonl.ts';

it('preserves Unicode paragraph separators and multibyte characters across buffer boundaries', async () => {
  const rows = [{ title: '中文\u2028換行\u2029符號', image: 'a\r\nb' }, { id: '2' }];
  const bytes = Buffer.from(rows.map((row) => JSON.stringify(row)).join('\n'));
  const chunks = Array.from(bytes, (byte) => Buffer.from([byte]));
  const result = [];
  for await (const line of jsonLines(Readable.from(chunks))) result.push(JSON.parse(line));
  expect(result).toEqual(rows);
});
it('bounds individual rows before parsing', async () => {
  await expect(async () => {
    for await (const _line of jsonLines(Readable.from([Buffer.from('abcdef')]), 5)) {
      /* drain */
    }
  }).rejects.toThrow('size limit');
});
