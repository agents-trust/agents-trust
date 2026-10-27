// PAID Recommend call: spends the quoted fee (currently 0.01 USDC, capped at 0.05) from YOUR wallet on Base.
// npm install && EVM_PRIVATE_KEY=0x... node paid.ts "weather forecast"
// The key comes from your environment or secret manager. Never commit it.
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, type PaymentPolicy } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

const MAX_ATOMIC = 50_000n; // your ceiling: 0.05 USDC in atomic units (6 decimals)
const cap: PaymentPolicy = (_version, accepts) => {
  const ok = accepts.filter((r) => BigInt(r.amount) <= MAX_ATOMIC);
  if (!ok.length) throw new Error(`quoted above cap ${MAX_ATOMIC}`);
  return ok;
};

const client = new x402Client();
registerExactEvmScheme(client, {
  signer: privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`),
  policies: [cap],
  networks: ["eip155:8453"], // pin Base
});

const need = process.argv[2] ?? "weather forecast";
const url = `https://api.agents-trust.com/recommend?${new URLSearchParams({ need, limit: "3", view: "compact" })}`;
const res = await wrapFetchWithPayment(fetch, client)(url);
const attempt = res.headers.get("x-at-payment-attempt-id");
console.log(res.status, "x-at-request-id:", res.headers.get("x-at-request-id"), "payment_attempt_id:", attempt);
console.log(JSON.stringify(await res.clone().json(), null, 2).slice(0, 2000));

if (attempt) {
  // The answer arrives before settlement; the receipt lookup is free. Never pay again while pending.
  const receipt = await fetch(`https://api.agents-trust.com/receipt?payment_attempt_id=${attempt}`);
  console.log(await receipt.json());
}

// Act on a pick, up to the provider's unpaid 402. This never pays the provider.
const BLOCKING = new Set(["WEAK_MATCH", "REQUIRED_INPUT_UNKNOWN"]);
const body = res.ok ? await res.clone().json().catch(() => null) : null;
const pick = (body?.picks ?? []).find(
  (p: any) => p.match_strength === "strong" && !(p.risk_flags ?? []).some((f: string) => BLOCKING.has(f)),
);
const inv = pick?.invocation;
if (!inv || inv.method !== "GET" || !/^https:\/\/[^{}]+$/.test(inv.url_template ?? "")) {
  console.log("No strong GET pick with a fixed URL; build the request from invocation yourself.");
} else {
  const quote = await fetch(inv.url_template, { signal: AbortSignal.timeout(15_000) });
  const header = quote.headers.get("payment-required");
  const terms = header ? JSON.parse(Buffer.from(header, "base64").toString("utf8")) : await quote.json().catch(() => null);
  console.log("provider", quote.status, JSON.stringify(terms?.accepts ?? terms, null, 2).slice(0, 1500));
  console.log("Compare amount, network and asset with your own cap before paying the provider.");
}
