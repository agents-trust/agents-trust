import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { AgentsTrustApi, type Settings } from './api.js';

export function createServer(settings: Settings = {}, request: typeof fetch = fetch) {
  const api = new AgentsTrustApi(settings, request);
  const server = new McpServer({ name: 'agents-trust', version: '0.1.0' });
  const run = async (action: () => Promise<unknown>) => {
    try {
      let text = JSON.stringify(await action());
      if (settings.walletKey) text = text.split(settings.walletKey).join('[redacted]');
      return { content: [{ type: 'text' as const, text }] };
    } catch (error) {
      let text = error instanceof Error ? error.message : 'Agents Trust request failed.';
      if (settings.walletKey) text = text.split(settings.walletKey).join('[redacted]');
      return { isError: true, content: [{ type: 'text' as const, text }] };
    }
  };
  const paymentHelp = 'Paid mode requires the wallet owner to supply AGENTS_TRUST_WALLET_PRIVATE_KEY with Base USDC (eip155:8453) and AGENTS_TRUST_ENABLE_PAYMENTS=true. Only Base payments are supported. AGENTS_TRUST_MAX_CALL_USDC and AGENTS_TRUST_SESSION_CAP_USDC cap the Agents Trust fee; one authorization per process, including failed or uncertain submissions. Never auto-retry a payment.';
  server.registerTool('recommend', {
    description: `Quote-only by default: no search ran and no provider results are available from a quote; matches and filter eligibility remain unknown until results are returned. Recommend normally costs 0.01 USDC; the live quote is authoritative. Current free demo phrases (entire need) are exactly "weather", "crypto prices" and "web search"; the need, not the response view, selects the demo. Demo picks skip live payment-challenge checks and do not prove paid delivery. Empty results are not settled. ${paymentHelp}`,
    inputSchema: {
      need: z.string().refine(s => Array.from(s).length >= 2 && Array.from(s).length <= 300 && /[\p{L}\p{N}].*[\p{L}\p{N}]/u.test(s), 'Use 2–300 characters with at least two letters or digits.').describe('Task in plain words: 2–300 Unicode characters (code points), including at least two Unicode letters or digits.'),
      limit: z.number().int().min(1).max(5).optional(),
      live: z.literal(1).optional().describe('Only 1 is accepted and is the default: request recent/live payment-challenge evidence, not verified paid delivery. Free demos skip this check; a quote cannot establish a live match.'),
      max_price_usd: z.number().finite().min(0).optional().describe('Maximum provider price per call in USD, not a spend cap or the Recommend fee. Owner fee caps are AGENTS_TRUST_MAX_CALL_USDC and AGENTS_TRUST_SESSION_CAP_USDC.'),
      chain: z.string().regex(/^[a-z0-9-]{2,16}:[A-Za-z0-9_=-]{1,64}$/).optional().describe('Provider payment network in CAIP-2 form, for example eip155:8453 for Base. Use the canonical network ID, not base or base:mainnet. This filter does not configure the client wallet.'),
      view: z.enum(['legacy', 'compact', 'evidence']).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, args => run(() => api.recommend(args)));
  server.registerTool('inspect', {
    description: `Read stored evidence for an exact endpoint URL without calling or paying the provider. Quote-only by default: a quote contains no endpoint evidence. Inspect costs 1% of the endpoint's lowest quoted price, minimum 0.001 USDC; read the actual quote. Unknown URLs return free HTTP 404 ENDPOINT_NOT_INDEXED as a normal not_found result, not an outage or a judgment against the provider. Some current demo URLs return evidence free; view does not grant a payment exemption. Pending/null delivery state and stored timestamps do not prove successful paid delivery; read evidence_guide. ${paymentHelp}`,
    inputSchema: {
      url: z.string().min(1).max(2048).refine(value => {
        try {
          const url = new URL(value);
          return url.protocol === 'https:' && !url.username && !url.password;
        } catch { return false; }
      }, 'Use an absolute HTTPS endpoint URL without credentials.').describe('Absolute HTTPS endpoint URL without username or password, 1–2048 characters, including fixed query parameters. The API rejects private URLs before payment.'),
      view: z.enum(['legacy', 'compact', 'evidence']).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, args => run(() => api.inspect(args)));
  server.registerTool('receipt', {
    description: 'Look up payment settlement by payment attempt ID. Free.',
    inputSchema: { payment_attempt_id: z.uuid() },
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, args => run(() => api.receipt(args.payment_attempt_id)));
  server.registerTool('health', {
    description: 'Read the Agents Trust service version. Free.', inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, () => run(() => api.health()));
  return server;
}
