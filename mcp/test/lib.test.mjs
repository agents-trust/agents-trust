import { test } from "node:test";
import assert from "node:assert/strict";
import { atomicToUsdc, usdcToAtomic, recommendUrl, decodePaymentRequired, summarizeQuote } from "../dist/lib.js";

test("USDC conversions", () => {
  assert.equal(atomicToUsdc("10000"), "0.01");
  assert.equal(atomicToUsdc("1000000"), "1");
  assert.equal(usdcToAtomic("0.01"), 10000n);
  assert.throws(() => usdcToAtomic("1e-2"));
});

test("recommendUrl sends each param once and defaults view=compact", () => {
  const u = new URL(recommendUrl("https://api.agents-trust.com", { need: "weather forecast", limit: 3 }));
  assert.equal(u.searchParams.getAll("need").length, 1);
  assert.equal(u.searchParams.get("view"), "compact");
  assert.equal(u.searchParams.has("chain"), false);
});

test("summarizeQuote reads v2 terms", () => {
  const pr = { x402Version: 2, resource: { url: "r" }, accepts: [{ scheme: "exact", network: "eip155:8453", amount: "10000", asset: "a", payTo: "p", maxTimeoutSeconds: 300 }], extensions: { "at-payment-attempt": { info: { paymentAttemptId: "x" } } } };
  const header = Buffer.from(JSON.stringify(pr)).toString("base64");
  const q = summarizeQuote(decodePaymentRequired(header));
  assert.equal(q.payable, true);
  assert.equal(q.options[0].amount_usdc, "0.01");
});
