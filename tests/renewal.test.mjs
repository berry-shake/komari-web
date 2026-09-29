import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRenewalDate, formatRenewalExpiry, isRenewalDue } from "../src/utils/renewal.ts";

test("renewal writes server wall time instead of shifting expiry through UTC", () => {
  assert.equal(formatRenewalExpiry(new Date("2026-11-22T16:00:00Z"), "2026-10-23T00:00:00+08:00"), "2026-11-23 00:00:00");
  assert.equal(formatRenewalExpiry(new Date("2026-11-23T15:59:59Z"), "2026-10-23T23:59:59+08:00"), "2026-11-23 23:59:59");
  assert.equal(formatRenewalExpiry(new Date("2026-11-23T03:30:00Z"), "2026-10-22T22:30:00-05:00"), "2026-11-22 22:30:00");
  assert.equal(formatRenewalExpiry(new Date("2026-11-23T10:00:00Z"), "2026-10-23T10:00:00Z"), "2026-11-23 10:00:00");
  assert.equal(formatRenewalExpiry(new Date(), "invalid"), null);
  assert.equal(formatRenewalExpiry(new Date(), null), null);
  assert.equal(formatRenewalExpiry(new Date(), undefined), null);
});

test("renewal is offered only from now through the next seven days, inclusive", () => {
  const now = Date.parse("2026-09-29T10:00:00Z");
  const end = Date.parse("2026-10-06T10:00:00Z");
  for (const time of [now, now + 1, end - 1, end]) {
    assert.equal(isRenewalDue(new Date(time).toISOString(), now), true);
  }
  for (const time of [now - 1, end + 1]) {
    assert.equal(isRenewalDue(new Date(time).toISOString(), now), false);
  }
  for (const value of ["", "invalid", undefined, null, "0001-01-01T00:00:00Z"]) {
    assert.equal(isRenewalDue(value, now), false);
  }
});

test("expiry offsets refer to the same instant, regardless of server timezone", () => {
  const now = Date.parse("2026-09-29T10:00:00Z");
  assert.equal(isRenewalDue("2026-10-06T18:00:00+08:00", now), true);
  assert.equal(isRenewalDue("2026-10-06T18:00:00.001+08:00", now), false);
});

test("standard billing cycles extend the original expiry by calendar months or years", () => {
  const expiry = new Date(2026, 2, 15, 14, 25, 37);
  const original = expiry.getTime();
  const cases = [
    [27, 2026, 3, 15], [30, 2026, 3, 15], [32, 2026, 3, 15],
    [87, 2026, 5, 15], [92, 2026, 5, 15], [95, 2026, 5, 15],
    [175, 2026, 8, 15], [180, 2026, 8, 15], [185, 2026, 8, 15],
    [360, 2027, 2, 15], [365, 2027, 2, 15], [370, 2027, 2, 15],
    [720, 2028, 2, 15], [730, 2028, 2, 15], [750, 2028, 2, 15],
    [1080, 2029, 2, 15], [1095, 2029, 2, 15], [1150, 2029, 2, 15],
    [1800, 2031, 2, 15], [1825, 2031, 2, 15], [1850, 2031, 2, 15],
  ];
  for (const [cycle, year, month, day] of cases) {
    assert.equal(
      computeRenewalDate(expiry, cycle)?.getTime(),
      new Date(year, month, day, 14, 25, 37).getTime(),
      `cycle ${cycle}`,
    );
  }
  assert.equal(expiry.getTime(), original, "calculation must not mutate the old expiry");
});

test("custom billing cycles add days, preserving local expiry time", () => {
  const expiry = new Date(2026, 2, 15, 14, 25, 37);
  for (const [cycle, month, day] of [[1, 2, 16], [7, 2, 22], [26, 3, 10], [33, 3, 17], [45, 3, 29], [100, 5, 23]]) {
    assert.equal(
      computeRenewalDate(expiry, cycle)?.getTime(),
      new Date(2026, month, day, 14, 25, 37).getTime(),
    );
  }
});

test("month-end and leap-day renewals retain upstream Date rollover semantics", () => {
  assert.equal(
    computeRenewalDate(new Date(2027, 0, 31, 12), 30)?.getTime(),
    new Date(2027, 2, 3, 12).getTime(),
  );
  assert.equal(
    computeRenewalDate(new Date(2028, 1, 29, 12), 365)?.getTime(),
    new Date(2029, 2, 1, 12).getTime(),
  );
});

test("unsupported, missing, and out-of-range billing data cannot produce a renewal", () => {
  const expiry = new Date(2026, 8, 30);
  for (const cycle of [0, -1, -30, NaN, Infinity, undefined, null, "30", 1.5, Number.MAX_SAFE_INTEGER]) {
    assert.equal(computeRenewalDate(expiry, cycle), null);
  }
  assert.equal(computeRenewalDate(new Date("invalid"), 30), null);
});
