// Pure evidence redaction; no cookie, auth or fixture token values in outputs.
export function redactHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      /cookie|authorization|token|api[-_]key|fixture[-_]actor/i.test(name) ? '[redacted]' : value,
    ]),
  );
}
export function redactHar(har) {
  const entries = har?.log?.entries;
  if (!Array.isArray(entries) || entries.length > 5000) throw Error('Bounded HAR entries required');
  for (const e of entries)
    for (const k of ['request', 'response']) {
      const o = e[k];
      if (!o) continue;
      for (const h of o.headers || []) if (/cookie|authorization|token|api[-_]key|fixture[-_]actor/i.test(h.name)) h.value = '[redacted]';
      for (const c of o.cookies || []) c.value = '[redacted]';
      if (o.postData) o.postData = { redacted: true };
    }
  return har;
}
export async function progressiveScroll(page, { maxHeight = 16000, maxSteps = 24 } = {}) {
  let steps = 0,
    hitLimit = false;
  while (steps < maxSteps) {
    const state = await page.evaluate(() => ({ top: scrollY, height: document.documentElement.scrollHeight, viewport: innerHeight }));
    if (state.height > maxHeight) {
      hitLimit = true;
      break;
    }
    if (state.top + state.viewport >= state.height) break;
    await page.evaluate(() => scrollBy(0, Math.max(200, innerHeight - 100)));
    await page.waitForTimeout(80);
    steps++;
  }
  if (steps === maxSteps) hitLimit = true;
  if (!hitLimit) {
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(150);
  }
  const state = await page.evaluate(() => ({
    footer: { present: !!document.querySelector('footer'), textLength: document.querySelector('footer')?.textContent?.length ?? 0 },
    images: [...document.images].map((i) => ({
      src: i.currentSrc || i.src,
      complete: i.complete,
      naturalWidth: i.naturalWidth,
      naturalHeight: i.naturalHeight,
      loading: i.loading,
    })),
    charts: [...document.querySelectorAll('canvas,svg[role="img"]')].map((c) => ({
      tag: c.tagName,
      width: c.getBoundingClientRect().width,
      height: c.getBoundingClientRect().height,
      busy: c.getAttribute('aria-busy'),
    })),
    skeletons: document.querySelectorAll('[aria-busy="true"],[data-skeleton],.animate-pulse').length,
    fonts: { status: document.fonts?.status ?? null },
    theme: {
      htmlClass: document.documentElement.className,
      bodyClass: document.body.className,
      mediaDark: matchMedia('(prefers-color-scheme: dark)').matches,
    },
    height: document.documentElement.scrollHeight,
  }));
  await page.evaluate(() => scrollTo(0, 0));
  return {
    ...state,
    steps,
    hitLimit,
    loaded:
      !hitLimit &&
      state.footer.present &&
      state.images.every((i) => i.complete && i.naturalWidth > 0) &&
      state.skeletons === 0 &&
      state.fonts?.status === 'loaded',
  };
}
export async function candidateResponse(response, { record, stop, origin }) {
  const url = response.url(),
    status = response.status();
  record({ event: 'response', url, status });
  if (status >= 500 && status <= 599 && new URL(url).origin === origin)
    await stop(Error('Candidate same-origin HTTP5xx; partial/missing fixture evidence retained'));
}
