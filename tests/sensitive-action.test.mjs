import { test } from "node:test";
import assert from "node:assert/strict";
import { sensitiveRequest, SensitiveActionError, generateAPIKey, downloadBackup } from "../src/lib/sensitiveAction.ts";

test("sensitive requests carry OTP only in a header and preserve JSON input", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (...args) => {
    calls.push(args);
    return new Response('{"status":"success"}', { status: 200 });
  });
  const payload = JSON.stringify({ api_key: "fixture-api-key" });
  await sensitiveRequest("/api/admin/settings/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }, "012345");
  const [path, options] = calls[0];
  assert.equal(path, "/api/admin/settings/");
  assert.equal(options.headers.get("X-2FA-Code"), "012345");
  assert.equal(options.headers.get("Content-Type"), "application/json");
  assert.equal(options.body, payload);
  assert.equal(options.cache, "no-store");
  assert.equal(options.credentials, "same-origin");
  await sensitiveRequest("/api/admin/2fa/generate", { method: "POST" });
  assert.equal(calls[1][1].headers.has("X-2FA-Code"), false);
});

test("a rejected backup request never triggers a download and exposes an actionable error", async (t) => {
  t.mock.method(globalThis, "fetch", async (path, options) => {
    assert.equal(path, "/api/admin/download/backup");
    assert.equal(options.headers.get("X-2FA-Code"), "invalid");
    return new Response('{"message":"Invalid 2FA code"}', { status: 401 });
  });
  // No DOM is installed. An unauthorized request must fail before creating a link.
  await assert.rejects(downloadBackup("invalid"), (error) => {
    assert.ok(error instanceof SensitiveActionError);
    assert.equal(error.status, 401);
    assert.equal(error.message, "Invalid 2FA code");
    return true;
  });
});

test("API keys come from browser cryptographic randomness", (t) => {
  t.mock.method(crypto, "getRandomValues", (buffer) => { buffer.fill(0xab); return buffer; });
  t.mock.method(Math, "random", () => { throw new Error("weak randomness must not be used"); });
  assert.equal(generateAPIKey(), "komari-" + "ab".repeat(32));
});
