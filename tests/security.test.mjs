import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { stringToBytes } from "../src/utils/unitHelper.ts";

test("byte input supports documented formats without executing expressions", () => {
  for (const [input, expected] of [["1MB",1048576],["128*1024gb",140737488355328],["1e3kb",1024000],["1.5 MB",1572864],["1,024",1024],["kb",1024]]) {
    assert.equal(stringToBytes(input), expected, input);
  }
  globalThis.byteInputExecuted = false;
  for (const input of ["(globalThis.byteInputExecuted=true,1)","fetch('https://example.com')","1/0","-1GB","1e999GB","0*Infinity","2**5","a".repeat(100000)]) {
    assert.equal(stringToBytes(input), 0, input.slice(0,100));
  }
  assert.equal(globalThis.byteInputExecuted, false);
  delete globalThis.byteInputExecuted;
});

test("footer strips executable HTML and preserves ordinary text/links", async () => {
  const dom = new JSDOM("<!doctype html>");
  globalThis.window = dom.window;
  const { sanitizeFooterHtml } = await import("../src/utils/footerHtml.ts");
  const clean = sanitizeFooterHtml('<a href="https://example.com">备案</a><b>hello</b><img src=x onerror="alert(1)"><svg onload="alert(1)"></svg><script>alert(1)</script><iframe srcdoc="bad"></iframe><a href="javascript:alert(1)">bad</a><form><input name="x"></form>');
  const fragment = JSDOM.fragment(clean);
  assert.equal(fragment.querySelector("a").href, "https://example.com/");
  assert.equal(fragment.querySelector("b").textContent, "hello");
  assert.equal(fragment.querySelector("script,iframe,svg,form,input,[onerror],[onload]"), null);
  assert.equal(fragment.querySelectorAll("a")[1].getAttribute("href"), null);
  dom.window.close();
  delete globalThis.window;
});
