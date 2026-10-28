import assert from "node:assert/strict";
import test from "node:test";
import { alipayOrderNo, amountCents, buildSignString, extractResponseNode, isAlipayOrderNo, prefersMobilePay, yuanText } from "../src/alipay.ts";

test("membership prices use two decimal yuan", () => {
  assert.equal(yuanText(190), "1.90");
  assert.equal(yuanText(990), "9.90");
  assert.equal(amountCents("1.90"), 190);
  assert.equal(amountCents("9.9"), null);
});

test("sign string sorts keys and drops the signature", () => {
  const content = buildSignString({
    sign: "ignored",
    method: "alipay.trade.wap.pay",
    app_id: "2021000000000000",
    biz_content: "{\"out_trade_no\":\"order\"}",
  });
  assert.equal(content, "app_id=2021000000000000&biz_content={\"out_trade_no\":\"order\"}&method=alipay.trade.wap.pay");
});

test("notify sign string also drops sign_type", () => {
  const content = buildSignString({
    sign: "ignored",
    sign_type: "RSA2",
    out_trade_no: "order",
    total_amount: "1.90",
  }, true);
  assert.equal(content, "out_trade_no=order&total_amount=1.90");
});

test("alipay order numbers stay within letters and digits", () => {
  const tradeNo = alipayOrderNo();
  assert.equal(isAlipayOrderNo(tradeNo), true);
  assert.equal(tradeNo.includes("-"), false);
});

test("phones use the app checkout and computers use the web checkout", () => {
  assert.equal(prefersMobilePay("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), true);
  assert.equal(prefersMobilePay("Mozilla/5.0 (Linux; Android 14; Pixel 7)"), true);
  assert.equal(prefersMobilePay("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"), false);
});

test("response node keeps the original json text", () => {
  const body = "{\"alipay_trade_query_response\":{\"code\":\"10000\",\"msg\":\"Success\"},\"sign\":\"abc\"}";
  assert.equal(extractResponseNode(body, "alipay_trade_query_response"), "{\"code\":\"10000\",\"msg\":\"Success\"}");
});
