import assert from "node:assert/strict";
import test from "node:test";
import { creemPlans, creemSignature, creemSignatureMatches, creemWebhookVerified, readCreemEvent } from "../src/creem.ts";

const userId = "ddc792e8-d0bb-4fa6-8197-eb27be8aeff3";

test("launch checkout is the only plan with the intro discount", () => {
  assert.equal(creemPlans.launch.discountCode, "LAUNCH6");
  assert.equal(creemPlans.launch.productId, "prod_fkKKTJazF5XoDbYFwjoQL");
  assert.equal(creemPlans.monthly.discountCode, "");
  assert.equal(creemPlans.monthly.productId, "prod_6v1tliH8ibjwNy0OI8mDD");
});

test("subscription payments grant once per transaction", () => {
  const paid = readCreemEvent({
    eventType: "subscription.paid",
    object: {
      product: { id: creemPlans.launch.productId },
      metadata: { userId },
      last_transaction_id: "tran_1",
      last_transaction: { amount: 299 },
      current_period_end_date: "2026-11-30T00:00:00.000Z",
    },
  });
  assert.equal(paid.action, "grant");
  assert.equal(paid.planCode, "launch");
  assert.equal(paid.transactionId, "tran_1");
  assert.equal(paid.amountCents, 299);
  assert.equal(readCreemEvent({
    eventType: "checkout.completed",
    object: {
      status: "completed",
      product: { id: creemPlans.monthly.productId },
      order: { transaction: "tran_1", amount: 499 },
      subscription: { metadata: { userId }, current_period_end_date: "2026-11-30T00:00:00.000Z" },
    },
  }).transactionId, "tran_1");
});

test("ending events revoke and unknown products are ignored", () => {
  const expired = readCreemEvent({
    eventType: "subscription.expired",
    object: {
      product: creemPlans.monthly.productId,
      metadata: { userId },
      current_period_end_date: "2026-11-30T00:00:00.000Z",
    },
  });
  assert.equal(expired.action, "revoke");
  assert.equal(readCreemEvent({ eventType: "subscription.scheduled_cancel", object: { product: { id: creemPlans.monthly.productId }, metadata: { userId } } }).action, "ignore");
  assert.equal(readCreemEvent({ eventType: "subscription.paid", object: { product: { id: "prod_other" }, metadata: { userId }, last_transaction_id: "tran_2" } }).action, "ignore");
});

test("webhook signatures use the raw body", async () => {
  const body = "{\"eventType\":\"subscription.paid\"}";
  const signature = await creemSignature("secret", body);
  assert.equal(await creemSignatureMatches("secret", body, signature), true);
  assert.equal(await creemSignatureMatches("secret", body, `sha256=${signature.toUpperCase()}`), true);
  assert.equal(await creemSignatureMatches("secret", `${body} `, signature), false);
  const headers = new Headers({ "creem-signature": signature });
  assert.equal(await creemWebhookVerified("secret", body, headers), true);
  assert.equal(await creemWebhookVerified("", body, headers), false);
});
