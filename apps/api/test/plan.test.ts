import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../src/password.ts";
import { assertImageInput, effectivePlan, extendExpiry, isMember } from "../src/plan.ts";
import type { Plan, Profile } from "../src/types.ts";

const plans: Plan[] = [
  { code: "free", name: "免费", price_cents: 0, duration_days: 0, promo: false, active: true, image_daily: 10, chat_daily: 200, video_daily: 0, max_image_size: "1K", description: "" },
  { code: "launch", name: "限时会员", price_cents: 190, duration_days: 30, promo: true, active: true, image_daily: 100, chat_daily: 2000, video_daily: 5, max_image_size: "2K", description: "" },
];

function profile(partial: Partial<Profile>): Profile {
  return {
    id: "u1",
    email: "a@b.cn",
    password_hash: "x",
    display_name: "阿简",
    role: "user",
    plan_code: "free",
    plan_expires_at: null,
    created_at: "2026-10-21T00:00:00.000Z",
    ...partial,
  };
}

test("password round trip", async () => {
  const stored = await hashPassword("huijian-pass");
  assert.equal(await verifyPassword("huijian-pass", stored), true);
  assert.equal(await verifyPassword("wrong-pass", stored), false);
});

test("expired membership falls back to free", () => {
  const user = profile({ plan_code: "launch", plan_expires_at: "2020-01-01T00:00:00.000Z" });
  assert.equal(isMember(user, Date.parse("2026-10-21T00:00:00.000Z")), false);
  assert.equal(effectivePlan(user, plans, Date.parse("2026-10-21T00:00:00.000Z")).code, "free");
});

test("active membership keeps paid limits", () => {
  const user = profile({ plan_code: "launch", plan_expires_at: "2026-12-01T00:00:00.000Z" });
  assert.equal(effectivePlan(user, plans, Date.parse("2026-10-21T00:00:00.000Z")).image_daily, 100);
});

test("free users cannot request 2K", () => {
  assert.throws(() => assertImageInput({ prompt: "白瓷杯", ratio: "1:1", size: "2K" }, "1K"), /2K/);
});

test("renewal extends from the later date", () => {
  const next = extendExpiry("2026-11-01T00:00:00.000Z", 30, Date.parse("2026-10-21T00:00:00.000Z"));
  assert.equal(next, "2026-12-01T00:00:00.000Z");
});
