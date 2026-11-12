// NODE_OPTIONS="--require .../fake-now.cjs" FAKE_NOW=2026-11-13T12:00:00+08:00
// Makes `new Date()`, `Date()` and `Date.now()` start at FAKE_NOW when the
// process starts and run forward normally, so the snapshot's relative times
// ("3 小時前"), freshness notes and ISR ages stay identical between captures
// taken days apart. Timers, performance.now() and explicit dates are untouched.
const target = Date.parse(process.env.FAKE_NOW ?? '');
if (Number.isFinite(target)) {
  const RealDate = Date;
  const offset = target - RealDate.now();
  const now = () => RealDate.now() + offset;
  function FakeDate(...args) {
    if (!new.target) return new RealDate(now()).toString();
    return args.length === 0 ? new RealDate(now()) : new RealDate(...args);
  }
  for (const key of Object.getOwnPropertyNames(RealDate)) {
    if (!['length', 'name', 'prototype'].includes(key)) Object.defineProperty(FakeDate, key, Object.getOwnPropertyDescriptor(RealDate, key));
  }
  FakeDate.now = now;
  FakeDate.prototype = RealDate.prototype;
  globalThis.Date = FakeDate;
}
