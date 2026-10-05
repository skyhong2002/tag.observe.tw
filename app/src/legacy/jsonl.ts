import { StringDecoder } from 'node:string_decoder';

// JSON permits literal U+2028/U+2029 inside strings. Node readline treats them
// as line separators; JSONL framing must split only on the actual LF byte.
export async function* jsonLines(input: AsyncIterable<Buffer | string>, maxLineBytes = 16 * 1024 ** 2) {
  const decoder = new StringDecoder('utf8');
  let pending = '';
  for await (const chunk of input) {
    pending += typeof chunk === 'string' ? chunk : decoder.write(chunk);
    let newline: number;
    while ((newline = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, newline);
      if (Buffer.byteLength(line) > maxLineBytes) throw new Error('JSONL row exceeds size limit');
      yield line;
      pending = pending.slice(newline + 1);
    }
    if (Buffer.byteLength(pending) > maxLineBytes) throw new Error('JSONL row exceeds size limit');
  }
  pending += decoder.end();
  if (pending) yield pending;
}
