// PAID Recommend call: spends up to 0.01 USDC from YOUR wallet on Base.
// npm install && EVM_PRIVATE_KEY=0x... node paid.ts "weather forecast"
// The key comes from your environment or secret manager. Never commit it.
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, type PaymentPolicy } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

const MAX_ATOMIC = 10_000n; // your ceiling: 0.01 USDC in atomic units (6 decimals)
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
console.log(JSON.stringify(await res.json(), null, 2).slice(0, 2000));

if (attempt) {
  // The answer arrives before settlement; the receipt lookup is free. Never pay again while pending.
  const receipt = await fetch(`https://api.agents-trust.com/receipt?payment_attempt_id=${attempt}`);
  console.log(await receipt.json());
}
