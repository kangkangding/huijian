import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "../src/http.ts";
import { moderationUrl, screenPrompt } from "../src/moderation.ts";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("live keys use the production moderation endpoint", () => {
  assert.equal(moderationUrl("creem_live_example"), "https://api.creem.io/v1/moderation/prompt");
  assert.equal(moderationUrl("creem_test_example"), "https://test-api.creem.io/v1/moderation/prompt");
});

test("allow is the only decision that continues", async () => {
  let seen = "";
  await screenPrompt("creem_live_example", "白瓷杯", "image:user", async (url, init) => {
    seen = String(url);
    assert.equal(JSON.parse(String(init?.body)).prompt, "白瓷杯");
    return jsonResponse(200, { decision: "allow", extra: true });
  });
  assert.equal(seen, "https://api.creem.io/v1/moderation/prompt");
});

test("deny and flag block before generation", async () => {
  for (const decision of ["deny", "flag"]) {
    await assert.rejects(
      () => screenPrompt("creem_live_example", "bad", "image:user", async () => jsonResponse(200, { decision })),
      (error: unknown) => error instanceof HttpError && error.status === 400 && error.code === "prompt",
    );
  }
});

test("moderation problems fail closed", async () => {
  const cases: Array<() => Promise<Response>> = [
    async () => jsonResponse(500, { decision: "allow" }),
    async () => jsonResponse(200, { decision: "unknown" }),
    async () => { throw new Error("timeout"); },
  ];
  for (const fetchImpl of cases) {
    await assert.rejects(
      () => screenPrompt("creem_live_example", "白瓷杯", "image:user", fetchImpl),
      (error: unknown) => error instanceof HttpError && error.status === 503,
    );
  }
  await assert.rejects(
    () => screenPrompt("creem_test_example", "白瓷杯", "image:user", async () => jsonResponse(200, { decision: "allow" })),
    (error: unknown) => error instanceof HttpError && error.status === 503,
  );
  await assert.rejects(
    () => screenPrompt(undefined, "白瓷杯", "image:user"),
    (error: unknown) => error instanceof HttpError && error.status === 503,
  );
});
