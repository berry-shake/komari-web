import { test } from "node:test";
import assert from "node:assert/strict";
import { billingExpiryFromDate, toDateInputValue } from "../src/utils/dateInput.ts";

test("billing dates retain the server calendar date across timezone offsets", () => {
  for (const timestamp of [
    "2026-10-02T00:00:00+08:00",
    "2026-10-02T00:00:00+14:00",
    "2026-10-02T23:59:59-08:00",
    "2026-10-02T00:00:00Z",
    "2026-10-02 00:00:00",
    "2026-10-02",
  ]) {
    assert.equal(toDateInputValue(timestamp), "2026-10-02");
  }
});

test("billing dates save at day end and never drift after repeated save and reopen", () => {
  let response = "2026-10-23T00:00:00+08:00";
  for (let i = 0; i < 5; i++) {
    const input = toDateInputValue(response);
    assert.equal(input, "2026-10-23");
    const saved = billingExpiryFromDate(input);
    assert.equal(saved, "2026-10-23 23:59:59");
    // The API interprets the timestamp in the application timezone.
    response = saved.replace(" ", "T") + "+08:00";
  }
  assert.equal(billingExpiryFromDate(""), "");
});

test("browser-generated dates use local fields at both ends of the day", () => {
  assert.equal(toDateInputValue(new Date(2226, 8, 29, 0, 5)), "2226-09-29");
  assert.equal(toDateInputValue(new Date(2226, 8, 29, 23, 55)), "2226-09-29");
});

test("missing and malformed dates are safe to render", () => {
  for (const value of [null, undefined, "", "invalid", new Date(NaN)]) {
    assert.equal(toDateInputValue(value), "");
  }
  assert.equal(toDateInputValue("0001-01-01T00:00:00Z"), "0001-01-01");
});
