// NODE_OPTIONS="--require .../fake-now.cjs" FAKE_NOW=2026-11-13T12:00:00+08:00
// Makes `new Date()` and `Date.now()` start at FAKE_NOW when the process starts
// and run forward normally, so the snapshot's relative times ("3 小時前"),
// freshness notes and ISR ages stay identical between captures taken days apart.
// Timers, performance.now() and explicit dates are untouched.
const target = Date.parse(process.env.FAKE_NOW ?? '');
if (Number.isFinite(target)) {
  const RealDate = Date;
  const offset = target - RealDate.now();
  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(RealDate.now() + offset);
      else super(...args);
    }
    static now() {
      return RealDate.now() + offset;
    }
  }
  globalThis.Date = FakeDate;
}
