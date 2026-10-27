import assert from "node:assert/strict";
import test from "node:test";
import { UpstreamError, agnesRoot, callAccounts, shouldRotate, type AgnesAccount } from "../src/agnes.ts";

const cn: AgnesAccount = { site: "cn", apiKey: "cn-key-1234567890" };
const intl: AgnesAccount = { site: "intl", apiKey: "intl-key-1234567890" };

test("roots stay on their own hosts", () => {
  assert.equal(agnesRoot("cn"), "https://api.agnes-ai.cn");
  assert.equal(agnesRoot("intl"), "https://apihub.agnes-ai.com");
});

test("busy, auth, quota and server errors rotate", () => {
  for (const status of [0, 401, 402, 403, 429, 500, 502]) assert.equal(shouldRotate(status), true);
  for (const status of [400, 404, 422]) assert.equal(shouldRotate(status), false);
});

test("a busy domestic call falls through to the international account", async () => {
  const seen: string[] = [];
  const { account, value } = await callAccounts([cn, intl], async (item) => {
    seen.push(item.site);
    if (item.site === "cn") throw new UpstreamError(429, "上游繁忙，请稍后再试");
    return "ok";
  });
  assert.deepEqual(seen, ["cn", "intl"]);
  assert.equal(account.site, "intl");
  assert.equal(value, "ok");
});

test("a bad prompt does not switch accounts", async () => {
  const seen: string[] = [];
  await assert.rejects(
    () => callAccounts([cn, intl], async (item) => {
      seen.push(item.site);
      throw new UpstreamError(400, "生成失败，请改一下描述再试");
    }),
    (error: unknown) => error instanceof UpstreamError && error.status === 400,
  );
  assert.deepEqual(seen, ["cn"]);
});
