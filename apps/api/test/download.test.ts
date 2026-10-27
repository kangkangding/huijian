import assert from "node:assert/strict";
import test from "node:test";
import { downloadTarget, mediaExtension } from "../src/download.ts";

test("agnes media hosts can be downloaded", () => {
  const url = downloadTarget("https://cos-platform-outputs.agnes-ai.cn/a/b.png");
  assert.equal(url?.hostname, "cos-platform-outputs.agnes-ai.cn");
  assert.ok(downloadTarget("https://files.agnes-ai.com/clip.mp4"));
});

test("other hosts and plain http are rejected", () => {
  assert.equal(downloadTarget("https://example.com/a.png"), null);
  assert.equal(downloadTarget("http://cos-platform-outputs.agnes-ai.cn/a.png"), null);
  assert.equal(downloadTarget("https://agnes-ai.cn.evil.com/a.png"), null);
  assert.equal(downloadTarget(""), null);
});

test("extension follows the media type", () => {
  assert.equal(mediaExtension("image/jpeg; charset=binary"), "jpg");
  assert.equal(mediaExtension("video/mp4"), "mp4");
  assert.equal(mediaExtension("text/html"), null);
});
