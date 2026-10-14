// Pure helpers: URL building, 402 decoding, quote summaries. No network, no keys.

export const DEFAULT_API_BASE = "https://api.agents-trust.com";
export const USER_AGENT = "agents-trust-mcp/0.1.0";
export const USDC_DECIMALS = 6;

export interface RecommendArgs {
  need: string;
  limit?: number;
  max_price_usd?: number;
  chain?: string;
  view?: "legacy" | "compact" | "evidence" | "debug";
}

// Every scalar appears at most once; the API rejects duplicates and unknown names.
export function recommendUrl(base: string, args: RecommendArgs): string {
  const url = new URL("/recommend", base);
  url.searchParams.set("need", args.need);
  if (args.limit !== undefined) url.searchParams.set("limit", String(args.limit));
  if (args.max_price_usd !== undefined) url.searchParams.set("max_price_usd", String(args.max_price_usd));
  if (args.chain !== undefined) url.searchParams.set("chain", args.chain);
  url.searchParams.set("view", args.view ?? "compact");
  return url.toString();
}

export function receiptUrl(base: string, paymentAttemptId: string): string {
  const url = new URL("/receipt", base);
  url.searchParams.set("payment_attempt_id", paymentAttemptId);
  return url.toString();
}

// PAYMENT-REQUIRED is standard base64 of UTF-8 JSON (x402 v2).
export function decodePaymentRequired(header: string): any {
  return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
}

export function atomicToUsdc(atomic: string): string {
  const n = BigInt(atomic);
  const unit = 10n ** BigInt(USDC_DECIMALS);
  const frac = (n % unit).toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "");
  return frac ? `${n / unit}.${frac}` : `${n / unit}`;
}

export function usdcToAtomic(usdc: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(usdc)) throw new Error(`not a USDC amount: ${usdc}`);
  const [whole, frac = ""] = usdc.split(".");
  return BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) + BigInt(frac.padEnd(USDC_DECIMALS, "0"));
}

// A compact, agent-readable view of the 402 terms.
export function summarizeQuote(pr: any) {
  const accepts = Array.isArray(pr?.accepts) ? pr.accepts : [];
  return {
    x402_version: pr?.x402Version,
    resource: pr?.resource?.url,
    payable: Boolean(pr?.extensions?.["at-payment-attempt"]),
    payment_attempt_id: pr?.extensions?.["at-payment-attempt"]?.info?.paymentAttemptId ?? null,
    options: accepts.map((a: any) => ({
      scheme: a.scheme,
      network: a.network,
      amount_atomic: a.amount ?? a.maxAmountRequired,
      amount_usdc: atomicToUsdc(String(a.amount ?? a.maxAmountRequired)),
      asset: a.asset,
      pay_to: a.payTo,
      max_timeout_seconds: a.maxTimeoutSeconds,
    })),
  };
}
