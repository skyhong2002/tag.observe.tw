// User-approved baseline: no automatic rebasing when a homepage becomes slower.
const siteBaselinesSeconds = Object.freeze({
  'https://tag.observe.tw/': 0.256,
  'https://blog.observe.tw/': 3.085,
  'https://youtube.observe.tw/': 0.289,
});
const siteBudgetsSeconds = Object.freeze(Object.fromEntries(
  Object.entries(siteBaselinesSeconds).map(([url, baseline]) => [url, Math.max(2, baseline * 2)]),
));
const baselineMeasurement = Object.freeze({
  startedUTC: '2026-10-13T05:47:30Z',
  finishedUTC: '2026-10-13T05:48:30Z',
  method: 'Five homepage HTML downloads per site, three seconds apart; median curl time_total; DNT:1 and Accept:text/html, no cookies, no cache-busting, no JS or GA',
  sourceReceipt: '/tmp/babysit/gate-baseline-receipt.md',
  sourceReceiptSha256: '1698e51b45f7a56b8b15bc16eaa24fce5bd5400c377cc1b2102d45d429c27544',
  previousReceiptSha256: 'c897d26530db7e78b988b5c8c2614d5baa6a7e1716d8852cdc29f43c612d267b',
  receiptRevision: 'Corrected by babysit after root14:20: DYNAMIC time_total includes origin, edge, network; measured values unchanged',
  repositoryReceipt: 'docs/gate-baseline-20261013.md',
  measuredFrom: 'skyhong-SM via Cloudflare; tag HIT, blog DYNAMIC/no-store, YT HIT/EXPIRED; end-to-end timing includes origin, edge and network',
});
module.exports = { siteBaselinesSeconds, siteBudgetsSeconds, baselineMeasurement };
