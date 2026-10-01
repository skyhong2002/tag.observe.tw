import { describe, expect, it } from 'vitest';
import { imageRequestAllowed, isAllowedImage } from '../src/image-allowlist.js';

const samples = [
  'https://attach.setn.com/newsimages/2026/09/28/1.jpg',
  'https://setn.com/a.jpg',
  'https://evilsetn.com/a.jpg',
  'https://www.google.com/favicon.ico',
  'https://avatars.githubusercontent.com/u/1',
  'http://127.0.0.1:19090/metrics',
  'https://d1qd3zoyy91a2c.cloudfront.net/image/x.jpg',
  'https://abc.cloudfront.net/x.jpg',
  'https://storage.googleapis.com/stateless-34-84-11-249/x.jpg',
  'https://storage.googleapis.com/other-bucket/x.jpg',
  'http://castle.womany.net/x.jpg',
  'http://attach.setn.com/x.jpg',
  'ftp://setn.com/x',
  'not a url',
];

// The web package is a separate TS project; load its matcher at runtime.
const webModule = '../../web/src/lib/images.ts';

describe('image allowlist', () => {
  it('gateway and web matchers agree', async () => {
    const { isAllowedImage: webIsAllowed } = (await import(webModule)) as { isAllowedImage: (u: string) => boolean };
    for (const u of samples) expect(isAllowedImage(u), u).toBe(webIsAllowed(u));
  });
  it('allows media hosts and exact shared CDN hosts, rejects everything else', () => {
    expect(isAllowedImage('https://attach.setn.com/newsimages/1.jpg')).toBe(true);
    expect(isAllowedImage('https://evilsetn.com/a.jpg')).toBe(false);
    expect(isAllowedImage('https://www.google.com/favicon.ico')).toBe(false);
    expect(isAllowedImage('https://abc.cloudfront.net/x.jpg')).toBe(false);
    expect(isAllowedImage('https://storage.googleapis.com/other-bucket/x.jpg')).toBe(false);
    expect(isAllowedImage('https://storage.googleapis.com/stateless-34-84-11-249/x.jpg')).toBe(true);
  });
  it('checks the /_next/image url parameter, including duplicates and local paths', () => {
    expect(imageRequestAllowed('/_next/image?url=%2Fimg%2Ftag.png&w=64&q=75')).toBe(true);
    expect(imageRequestAllowed('/_next/image/?url=https%3A%2F%2Fattach.setn.com%2Fa.jpg&w=64&q=75')).toBe(true);
    expect(imageRequestAllowed('/_next/image?url=https%3A%2F%2Fwww.google.com%2Ffavicon.ico&w=64')).toBe(false);
    expect(imageRequestAllowed('/_next/image?url=%2F%2Fevil.com%2Fa.png&w=64')).toBe(false);
    expect(imageRequestAllowed('/_next/image?url=https%3A%2F%2Fattach.setn.com%2Fa.jpg&url=https%3A%2F%2Fevil.com%2Fa&w=64')).toBe(false);
    expect(imageRequestAllowed('/_next/image?w=64')).toBe(false);
  });
});
