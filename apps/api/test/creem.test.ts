import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ModerationRejected,
  ModerationUnavailable,
  moderationFailure,
  screenPrompt,
  type CreemEnv,
} from "../src/creem.ts";

const live: CreemEnv = { APP_ENV: "production", CREEM_API_KEY: "creem_live_example" };
const sandbox: CreemEnv = { APP_ENV: "development", CREEM_API_KEY: "creem_test_example", CREEM_API_BASE: "https://test-api.creem.io" };

function jsonResponse(decision: unknown, status = 200): Response {
  return new Response(JSON.stringify({ id: "mod_1", object: "moderation_result", decision, usage: { units: 1 } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("allow is the only decision that proceeds, and only the user prompt is sent", async () => {
  let seenUrl = "";
  let seenInit: RequestInit | undefined;
  await screenPrompt(live, "白瓷杯", async (url, init) => {
    seenUrl = String(url);
    seenInit = init;
    return jsonResponse("allow");
  });
  assert.equal(seenUrl, "https://api.creem.io/v1/moderation/prompt");
  assert.equal(seenInit?.method, "POST");
  const headers = new Headers(seenInit?.headers);
  assert.equal(headers.get("x-api-key"), "creem_live_example");
  assert.equal(headers.get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(String(seenInit?.body)), { prompt: "白瓷杯" });
  assert.equal(seenInit?.redirect, "manual");
  assert.ok(seenInit?.signal);
});

test("deny and flag are moderation rejections and do not look like outages", async () => {
  for (const decision of ["deny", "flag"] as const) {
    const error = await assert.rejects(
      () => screenPrompt(live, "提示词", async () => jsonResponse(decision)),
      (caught: unknown) => caught instanceof ModerationRejected && caught.decision === decision,
    );
    void error;
    const failure = moderationFailure(new ModerationRejected(decision));
    assert.equal(failure?.status, 400);
    assert.equal(failure?.code, "moderation");
    assert.match(failure?.message ?? "", /内容审核/);
  }
});

test("missing key, bad key, sandbox key, and sandbox base fail closed before any request", async () => {
  const cases: CreemEnv[] = [
    { APP_ENV: "production" },
    { APP_ENV: "production", CREEM_API_KEY: "   " },
    { APP_ENV: "production", CREEM_API_KEY: "creem_test_example" },
    { APP_ENV: "production", CREEM_API_KEY: "sk_live_example" },
    { APP_ENV: "production", CREEM_API_KEY: "creem_live_example", CREEM_API_BASE: "https://test-api.creem.io" },
    { APP_ENV: "production", CREEM_API_KEY: "creem_live_example", CREEM_API_BASE: "https://evil.example" },
    { APP_ENV: "development", CREEM_API_KEY: "creem_test_example" },
    { APP_ENV: "development", CREEM_API_KEY: "creem_test_example", CREEM_API_BASE: "https://api.creem.io" },
    { APP_ENV: "development", CREEM_API_KEY: "creem_live_example", CREEM_API_BASE: "https://test-api.creem.io" },
    {},
  ];
  for (const env of cases) {
    let called = false;
    await assert.rejects(
      () => screenPrompt(env, "白瓷杯", async () => {
        called = true;
        return jsonResponse("allow");
      }),
      (caught: unknown) => caught instanceof ModerationUnavailable,
    );
    assert.equal(called, false, JSON.stringify(env));
    assert.equal(moderationFailure(new ModerationUnavailable("missing_key"))?.status, 503);
  }
});

test("timeout, network errors, non-2xx, and unknown decisions fail closed", async () => {
  await assert.rejects(
    () => screenPrompt(live, "白瓷杯", async (_url, init) => {
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason ?? new Error("aborted")));
      });
      return jsonResponse("allow");
    }, 20),
    (caught: unknown) => caught instanceof ModerationUnavailable && caught.reason === "network",
  );
  await assert.rejects(
    () => screenPrompt(live, "白瓷杯", async () => {
      throw new Error("econnreset");
    }),
    (caught: unknown) => caught instanceof ModerationUnavailable && caught.reason === "network",
  );
  for (const status of [301, 400, 401, 403, 429, 500, 503]) {
    await assert.rejects(
      () => screenPrompt(live, "白瓷杯", async () => jsonResponse("allow", status)),
      (caught: unknown) => caught instanceof ModerationUnavailable && caught.reason === "http",
    );
  }
  for (const decision of [undefined, null, "", "block", "ALLOW"]) {
    await assert.rejects(
      () => screenPrompt(live, "白瓷杯", async () => jsonResponse(decision)),
      (caught: unknown) => caught instanceof ModerationUnavailable && caught.reason === "decision",
    );
  }
  await assert.rejects(
    () => screenPrompt(live, "白瓷杯", async () => new Response("nope", { status: 200 })),
    (caught: unknown) => caught instanceof ModerationUnavailable && caught.reason === "body",
  );
});

test("development sandbox key uses the sandbox host only when asked", async () => {
  let seen = "";
  await screenPrompt(sandbox, "白瓷杯", async (url) => {
    seen = String(url);
    return jsonResponse("allow");
  });
  assert.equal(seen, "https://test-api.creem.io/v1/moderation/prompt");
});

test("image and video creation screen the prompt before quota or Agnes; chat and poll do not", () => {
  const source = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  const calls = source.match(/moderatePrompt\(/g) ?? [];
  assert.equal(calls.length, 3);
  const images = handler(source, 'app.post("/api/images"', 'app.get("/api/images"');
  const videos = handler(source, 'app.post("/api/videos"', 'app.get("/api/videos"');
  const chat = handler(source, 'app.post("/api/chat"', 'app.get("/api/chat/conversations"');
  const poll = handler(source, 'app.get("/api/videos/:id"', 'app.get("/api/admin/provider-key"');
  assert.ok(images.indexOf("moderatePrompt(") < images.indexOf("reserveQuota("));
  assert.ok(images.indexOf("moderatePrompt(") < images.indexOf("createImage("));
  assert.ok(videos.indexOf("moderatePrompt(") < videos.indexOf("reserveQuota("));
  assert.ok(videos.indexOf("moderatePrompt(") < videos.indexOf("createVideo("));
  assert.equal(chat.includes("moderatePrompt("), false);
  assert.equal(poll.includes("moderatePrompt("), false);
  assert.equal(poll.includes("pollVideo("), true);
});

function handler(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, start);
  return source.slice(from, to);
}
