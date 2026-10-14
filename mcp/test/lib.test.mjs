import { test } from "node:test";
import assert from "node:assert/strict";
import { atomicToUsdc, usdcToAtomic, recommendUrl, decodePaymentRequired, summarizeQuote, isBaseUsdc, BASE_USDC } from "../dist/lib.js";
import { spawnSync } from "node:child_process";

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

test("only USDC on Base is marked payable by this server", () => {
  const pr = { x402Version: 2, accepts: [
    { network: "eip155:8453", amount: "10000", asset: BASE_USDC.toLowerCase() },
    { network: "eip155:8453", amount: "10000", asset: "0x0000000000000000000000000000000000000001" },
    { network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", amount: "10000", asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  ] };
  assert.deepEqual(summarizeQuote(pr).options.map((o) => o.payable_by_this_server), [true, false, false]);
  assert.equal(isBaseUsdc("eip155:8453", undefined), false);
});

test("a malformed key exits before use and is never echoed", () => {
  const bad = "0xnot-a-key-" + "z".repeat(20);
  const r = spawnSync(process.execPath, ["dist/index.js"], {
    env: { ...process.env, AGENTS_TRUST_EVM_PRIVATE_KEY: bad }, input: "", encoding: "utf8", timeout: 10000,
  });
  assert.equal(r.status, 1);
  assert.ok(!r.stderr.includes(bad) && !r.stdout.includes(bad));
  assert.match(r.stderr, /not a 0x-prefixed 32-byte hex key/);
});
