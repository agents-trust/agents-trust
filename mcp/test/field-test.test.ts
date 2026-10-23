import { it, expect, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { generatePrivateKey } from 'viem/accounts';
import { createServer } from '../src/server.js';
import { AgentsTrustApi } from '../src/api.js';
import fixture from './fixtures/payment-required.json' with { type: 'json' };

function quote(change: (value: typeof fixture) => void = () => {}) {
  const value = structuredClone(fixture);
  change(value);
  return new Response(null, { status: 402, headers: {
    'payment-required': Buffer.from(JSON.stringify(value)).toString('base64'),
    'x-at-request-id': 'quote-request',
  } });
}
async function withClient(request: typeof fetch, action: (client: Client) => Promise<void>) {
  const server = createServer({}, request);
  const client = new Client({ name: 'field-test-regression', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a); await client.connect(b);
  try { await action(client); }
  finally { await client.close(); await server.close(); }
}
function decoded(result: Awaited<ReturnType<Client['callTool']>>) {
  const content = result.content as { type: string; text: string }[];
  return JSON.parse(content[0]!.text);
}

// Finding 1: a fee challenge is not provider discovery or filter evidence.
it('makes a filtered no-wallet quote explicitly unsearched with unknown matches and no picks', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(quote());
  await withClient(request, async client => {
    const result = await client.callTool({ name: 'recommend', arguments: {
      need: 'satellite imagery', chain: 'eip155:8453', live: 1, max_price_usd: 0.005,
    } });
    expect(result.isError).not.toBe(true);
    const value = decoded(result);
    expect(value.data).toMatchObject({ mode: 'quote-only', outcome: 'payment_required', http_status: 402,
      search_performed: false, provider_matches: 'unknown', filters_evaluated: false,
      payment_required: true, payment_submitted: false });
    expect(value.data.message).toContain('No search ran. No provider results yet.');
    expect(value.data.message).toContain('Payment is required to see matches');
    expect(value.data).not.toHaveProperty('picks');
    expect(value.data).not.toHaveProperty('results');
    expect(value.payment_attempt_id).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]![1]?.headers).toBeUndefined();
  });
});

// Finding 2: match the actual signer's capability, not the service's networks.
it('shows only supported pinned Base offers with explicit USDC units', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(quote(value => {
    value.accepts.push({ ...value.accepts[0]!, payTo: '0x0000000000000000000000000000000000000000' });
  }));
  const result = await new AgentsTrustApi({}, request).recommend({ need: 'satellite imagery' });
  expect(result.data).toMatchObject({ client_payment_network: 'eip155:8453', offers: [
    { network: 'eip155:8453', client_supported: true, decimals: 6, amount_usdc: '0.010000' },
  ] });
  expect(JSON.stringify(result)).not.toContain('solana:');
});
it('does not invent a supported offer when the quote has only Solana', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(quote(value => {
    value.accepts = value.accepts.filter(offer => offer.network.startsWith('solana:'));
  }));
  const result = await new AgentsTrustApi({}, request).recommend({ need: 'satellite imagery' });
  expect(result.data).toMatchObject({ offers: [], provider_matches: 'unknown', payment_submitted: false });
  expect(request).toHaveBeenCalledTimes(1);
});

// Findings 3/4/7: assert what tools/list actually tells the model, not source comments.
it('publishes fee, demo and wallet-owner help without an external documentation fetch', async () => {
  await withClient(vi.fn<typeof fetch>(), async client => {
    const { tools } = await client.listTools();
    const recommend = tools.find(tool => tool.name === 'recommend')!;
    const inspect = tools.find(tool => tool.name === 'inspect')!;
    expect(recommend.description).toContain('0.01 USDC');
    for (const phrase of ['"weather"', '"crypto prices"', '"web search"']) expect(recommend.description).toContain(phrase);
    expect(recommend.description).toContain('need, not the response view');
    expect(recommend.description).toContain('matches and filter eligibility remain unknown');
    expect(inspect.description).toContain('free HTTP 404 ENDPOINT_NOT_INDEXED');
    expect(inspect.description).toContain('demo URLs return evidence free');
    for (const tool of [recommend, inspect]) {
      for (const text of ['wallet owner', 'AGENTS_TRUST_WALLET_PRIVATE_KEY', 'AGENTS_TRUST_ENABLE_PAYMENTS=true', 'Base USDC', 'one authorization per process']) {
        expect(tool.description).toContain(text);
      }
    }
  });
});
it('explains CAIP-2, live challenge limits and provider-price versus owner fee caps', async () => {
  await withClient(vi.fn<typeof fetch>(), async client => {
    const { tools } = await client.listTools();
    const fields = tools.find(tool => tool.name === 'recommend')!.inputSchema.properties as Record<string, { description: string }>;
    expect(fields.chain!.description).toContain('CAIP-2');
    expect(fields.chain!.description).toContain('eip155:8453 for Base');
    expect(fields.live!.description).toContain('not verified paid delivery');
    expect(fields.live!.description).toContain('Free demos skip');
    expect(fields.max_price_usd!.description).toContain('provider price');
    expect(fields.max_price_usd!.description).toContain('not a spend cap');
    expect(fields.max_price_usd!.description).toContain('AGENTS_TRUST_MAX_CALL_USDC');
    expect(fields.max_price_usd!.description).toContain('AGENTS_TRUST_SESSION_CAP_USDC');
  });
});
it('exposes Unicode bounds and HTTPS/no-credentials constraints while keeping runtime validation', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ picks: [] }));
  await withClient(request, async client => {
    const { tools } = await client.listTools();
    const need = tools[0]!.inputSchema.properties!.need as { description: string };
    const url = tools[1]!.inputSchema.properties!.url as { description: string };
    expect(need.description).toContain('2–300 Unicode characters (code points)');
    expect(need.description).toContain('at least two Unicode letters or digits');
    expect(url.description).toContain('HTTPS');
    expect(url.description).toContain('without username or password');
    expect(url.description).toContain('1–2048');
    for (const value of ['a', 'a'.repeat(301), '!!']) {
      expect((await client.callTool({ name: 'recommend', arguments: { need: value } })).isError).toBe(true);
    }
    expect((await client.callTool({ name: 'inspect', arguments: { url: 'https://user:password@example.com/' } })).isError).toBe(true);
    expect(request).not.toHaveBeenCalled();
    // Supplementary-plane letters count as one Unicode character each, not two UTF-16 units.
    expect((await client.callTool({ name: 'recommend', arguments: { need: '\u{10400}'.repeat(300) } })).isError).not.toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });
});

// Finding 5: only the confirmed, unpaid semantic miss is a non-error result.
it('keeps repeated unindexed URLs out of the MCP error path and health working', async () => {
  const request = vi.fn<typeof fetch>().mockImplementation(async target => new URL(String(target)).pathname === '/health'
    ? Response.json({ status: 'ok' })
    : Response.json({ error: { code: 'ENDPOINT_NOT_INDEXED', message: 'upstream internals must not be echoed' } },
      { status: 404, headers: { 'x-at-request-id': 'not-indexed-request' } }));
  await withClient(request, async client => {
    for (let i = 0; i < 4; i++) {
      const result = await client.callTool({ name: 'inspect', arguments: { url: `https://example.com/unknown-${i}` } });
      expect(result.isError).not.toBe(true);
      const value = decoded(result);
      expect(value).toMatchObject({ data: { outcome: 'not_found', http_status: 404, code: 'ENDPOINT_NOT_INDEXED',
        payment_required: false, payment_submitted: false }, payment_attempt_id: null, request_id: 'not-indexed-request' });
      expect(value.data.message).toContain('not a service outage');
      expect(JSON.stringify(value)).not.toContain('upstream internals');
    }
    const health = await client.callTool({ name: 'health', arguments: {} });
    expect(health.isError).not.toBe(true);
    expect(decoded(health).data.status).toBe('ok');
    expect(request).toHaveBeenCalledTimes(5);
    expect(request.mock.calls.every(([, init]) => !init?.headers)).toBe(true);
  });
});
it.each(['generic-404', 'server-500', 'malformed-404', 'transport'])('keeps genuine %s failures on the error path', async failure => {
  const request = vi.fn<typeof fetch>().mockImplementation(async () => {
    if (failure === 'transport') throw new Error('network unavailable');
    if (failure === 'malformed-404') return new Response('not json', { status: 404 });
    return Response.json({ error: { code: 'SOMETHING_ELSE' } }, { status: failure === 'server-500' ? 500 : 404 });
  });
  await withClient(request, async client => {
    expect((await client.callTool({ name: 'inspect', arguments: { url: 'https://example.com/api' } })).isError).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
it('never describes a post-authorization 404 as free or refunds the consumed grant', async () => {
  const endpoint = 'https://example.com/api';
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(quote(value => {
    value.resource.url = 'https://api.agents-trust.com/inspect?url=https%3A%2F%2Fexample.com%2Fapi';
  })).mockResolvedValueOnce(Response.json({ error: { code: 'ENDPOINT_NOT_INDEXED' } }, { status: 404 }))
    .mockResolvedValue(quote());
  const api = new AgentsTrustApi({ enablePayments: true, walletKey: generatePrivateKey() }, request);
  await expect(api.inspect({ url: endpoint })).rejects.toThrow('HTTP 404');
  await expect(api.inspect({ url: endpoint })).rejects.toThrow('Payment authorization already used');
  expect(request.mock.calls.filter(([, init]) => init?.headers)).toHaveLength(1);
});

// Finding 6: retain the evidence exactly and attach plain, status-first meanings.
it.each(['recommend', 'inspect'] as const)('explains pending delivery, match warnings and independent schema freshness for %s', async route => {
  const endpoint = {
    delivery_verification: { status: 'pending', last_verified_at: '2026-10-08T12:30:10Z' },
    risk_flags: ['PAID_DELIVERY_NOT_TESTED', 'WEAK_MATCH', 'INVOCATION_CAPTURE_STALE'],
    match_strength: 'weak', call_readiness: { status: 'unknown' },
    invocation: { freshness: { input_schema: { current_offer_match: true }, output_schema: { current_offer_match: false } } },
  };
  const body = route === 'inspect' ? { endpoint } : { picks: [endpoint] };
  await withClient(vi.fn<typeof fetch>().mockResolvedValue(Response.json(body)), async client => {
    const result = await client.callTool({ name: route, arguments: route === 'inspect' ? { url: 'https://example.com/api' } : { need: 'web search' } });
    const value = decoded(result);
    expect(value.data).toEqual(body);
    expect(value.evidence_guide.delivery_verification).toContain('pending, not_tested or null do not establish successful paid delivery');
    expect(value.evidence_guide.delivery_verification).toContain('last_verified_at alone does not prove success');
    expect(value.evidence_guide.PAID_DELIVERY_NOT_TESTED).toContain('has not been established');
    expect(value.evidence_guide.match_strength).toContain('not guaranteed capability');
    expect(value.evidence_guide.call_readiness).toContain('does not prove every parameter is optional');
    expect(value.evidence_guide.current_offer_match).toContain('input_schema and output_schema separately');
    expect(value.evidence_guide.current_offer_match).toContain('true matches that component');
    expect(value.evidence_guide.current_offer_match).toContain('false does not, null is unknown');
    expect(value.evidence_guide.null).toContain('never zero, false or verified');
  });
});
