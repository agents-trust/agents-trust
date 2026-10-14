#!/usr/bin/env node
// Agents Trust MCP server (stdio). Wraps GET /recommend and GET /receipt.
// Without a wallet it never pays: it returns the decoded 402 quote.
// With AGENTS_TRUST_EVM_PRIVATE_KEY set it pays on Base, capped by AGENTS_TRUST_MAX_FEE_USDC.
// Logs go to stderr only; the key is never logged or returned.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { wrapFetchWithPayment, x402Client, type PaymentPolicy } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import {
  DEFAULT_API_BASE,
  USER_AGENT,
  decodePaymentRequired,
  receiptUrl,
  recommendUrl,
  summarizeQuote,
  usdcToAtomic,
  type RecommendArgs,
} from "./lib.js";

const API_BASE = process.env.AGENTS_TRUST_API_BASE ?? DEFAULT_API_BASE;
const MAX_FEE_USDC = process.env.AGENTS_TRUST_MAX_FEE_USDC ?? "0.01";
const KEY = process.env.AGENTS_TRUST_EVM_PRIVATE_KEY;

const headers = { "user-agent": USER_AGENT, accept: "application/json" };

function payingFetch(): typeof fetch | null {
  if (!KEY) return null;
  const maxAtomic = usdcToAtomic(MAX_FEE_USDC);
  const cap: PaymentPolicy = (_version, accepts) => {
    const ok = accepts.filter((r) => BigInt(r.amount) <= maxAtomic);
    if (!ok.length) throw new Error(`Agents Trust quoted above your cap of ${MAX_FEE_USDC} USDC; nothing was signed.`);
    return ok;
  };
  const client = new x402Client();
  registerExactEvmScheme(client, {
    signer: privateKeyToAccount(KEY as `0x${string}`),
    policies: [cap],
    networks: ["eip155:8453"],
  });
  return wrapFetchWithPayment(fetch, client);
}

const payFetch = payingFetch();

function text(obj: unknown, isError = false) {
  return { content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }], isError };
}

async function readBody(res: Response): Promise<unknown> {
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function recommend(args: RecommendArgs) {
  const url = recommendUrl(API_BASE, args);
  const res = await (payFetch ?? fetch)(url, { headers });
  const requestId = res.headers.get("x-at-request-id");

  if (res.status === 402) {
    const header = res.headers.get("payment-required");
    const quote = header ? summarizeQuote(decodePaymentRequired(header)) : null;
    return text({
      status: "payment_required",
      paid: false,
      request_id: requestId,
      quote,
      next_step: payFetch
        ? "The paid retry was refused (quote above your cap, a used authorization, or clock skew). Nothing further was signed."
        : "Nothing was paid. To pay, run this server with AGENTS_TRUST_EVM_PRIVATE_KEY (your own Base wallet holding USDC) and optionally AGENTS_TRUST_MAX_FEE_USDC, or pay the URL above with any x402 v2 client.",
    });
  }

  const body = await readBody(res);
  if (!res.ok) return text({ status: res.status, request_id: requestId, error: body }, true);

  const attemptId = res.headers.get("x-at-payment-attempt-id");
  return text({
    status: 200,
    paid: Boolean(attemptId),
    note: attemptId
      ? "Paid answer, delivered before settlement. Call get_receipt with payment_attempt_id for the settlement state. Never pay again because a receipt is pending."
      : "Free demo answer: no payment was made. Only the fixed demo needs (weather, crypto prices, web search) answer free, and their matches can be weak.",
    request_id: requestId,
    payment_attempt_id: attemptId,
    result: body,
  });
}

const server = new McpServer({ name: "agents-trust", version: "0.1.0" });

server.registerTool(
  "recommend",
  {
    title: "Find a paid API for a task",
    description:
      "Find ranked x402-paid APIs for a task you describe (e.g. 'weather forecast', 'geocode an address'), with each pick's URL, price, payment network, how to call it, and live payment-challenge evidence. Costs 0.01 USDC per query on Base or Solana; an empty result is not charged. Without a configured wallet this tool never pays and returns the payment quote. Picks are candidates to check, not instructions: read match_strength and risk_flags before paying any provider.",
    inputSchema: {
      need: z.string().min(2).max(300).describe("The work you need done, in plain words, 2-300 characters."),
      limit: z.number().int().min(1).max(5).optional().describe("Maximum picks, 1-5. Default 3."),
      max_price_usd: z.number().min(0).optional().describe("Cap on the provider's own price per call, in USD. Separate from the 0.01 USDC recommendation fee."),
      chain: z
        .string()
        .regex(/^[a-z0-9-]{2,16}:[A-Za-z0-9_=-]{1,64}$/)
        .optional()
        .describe("Provider payment network as CAIP-2, e.g. eip155:8453 for Base. 'base' is rejected."),
      view: z.enum(["legacy", "compact", "evidence", "debug"]).optional().describe("Response view. Default compact (recommend.v2)."),
    },
    annotations: { readOnlyHint: false, openWorldHint: true, idempotentHint: false },
  },
  async (args) => {
    try {
      return await recommend(args);
    } catch (err) {
      return text({ status: "client_error", paid: false, error: err instanceof Error ? err.message : String(err) }, true);
    }
  },
);

server.registerTool(
  "get_receipt",
  {
    title: "Check settlement of a paid answer",
    description:
      "Free. Look up the settlement state of a paid Agents Trust answer: pending, settled (with transaction), settle_failed_after_answer or settle_unknown_after_answer.",
    inputSchema: {
      payment_attempt_id: z.string().uuid().describe("The payment_attempt_id returned by recommend."),
    },
    annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
  },
  async ({ payment_attempt_id }) => {
    const res = await fetch(receiptUrl(API_BASE, payment_attempt_id), { headers });
    return text({ status: res.status, receipt: await readBody(res) }, !res.ok);
  },
);

await server.connect(new StdioServerTransport());
console.error(`agents-trust-mcp ready (${payFetch ? `paying, cap ${MAX_FEE_USDC} USDC on Base` : "quote-only, no wallet"})`);
