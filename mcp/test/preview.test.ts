import { it, expect, vi } from 'vitest';
import { AgentsTrustApi } from '../src/api.js';
import fixture from './fixtures/payment-required.json' with { type: 'json' };

it('shows an unsigned catalog preview with an explicit paid-search disclaimer and no internals', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
    preview: { ranked: false, candidates: [{ name: 'Catalog API', url: 'https://catalog.example/api', price: 0.001,
      network: ['eip155:8453'], rank: 1, score: 99, confidence: 1, evidence: {}, endpoint_id: 'private' }] },
  }), { status: 402, headers: { 'payment-required': Buffer.from(JSON.stringify(fixture)).toString('base64') } }));
  const result = await new AgentsTrustApi({}, request).recommend({ need: 'weather forecast' });
  const data = result.data as { message: string; preview?: { note: string; candidates: Record<string, unknown>[] }; provider_matches: string };
  expect(data).toMatchObject({ search_performed: true, paid_search_performed: false, payment_submitted: false,
    preview: { ranked: false, candidates: [{ name: 'Catalog API', price: 0.001 }] } });
  expect(data.message).toContain('No paid search ran.');
  expect(data.preview?.note).toBe('not ranked; pay 0.01 USDC for the ranked recommendation with evidence');
  expect(Object.keys(data.preview!.candidates[0]!).sort()).toEqual(['name', 'network', 'price', 'url']);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0]![1]?.headers).toBeUndefined();
});

it('preserves an empty abstention preview without inventing matches', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ preview: { ranked: false, candidates: [], reason: 'No catalog matches for this need.' } }), {
    status: 402, headers: { 'payment-required': Buffer.from(JSON.stringify(fixture)).toString('base64') },
  }));
  const result = await new AgentsTrustApi({}, request).recommend({ need: 'unknown task' });
  const data = result.data as { preview: unknown; provider_matches: string };
  expect(data.preview).toMatchObject({ candidates: [], ranked: false, reason: 'No catalog matches for this need.' });
  expect(data.provider_matches).toBe('unknown');
});

it.each([undefined, 'Candidates are temporarily unavailable.'])('preserves unknown availability: %s', async reason => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
    preview: { ranked: false, candidates: [], reason },
  }), { status: 402, headers: { 'payment-required': Buffer.from(JSON.stringify(fixture)).toString('base64') } }));
  const result = await new AgentsTrustApi({}, request).recommend({ need: 'weather forecast' });
  expect(result.data).toMatchObject({ preview: { reason: 'Candidates are temporarily unavailable.' } });
});
it('reports malformed candidates as unavailable and uses the quoted fee', async () => {
  const terms = { ...fixture, accepts: fixture.accepts.map(offer => ({ ...offer, amount: '25000' })) };
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
    preview: { ranked: false, candidates: [{}], reason: 'No candidates available for this need.' },
  }), { status: 402, headers: { 'payment-required': Buffer.from(JSON.stringify(terms)).toString('base64') } }));
  const result = await new AgentsTrustApi({}, request).recommend({ need: 'weather forecast' });
  expect(result.data).toMatchObject({ preview: { candidates: [], reason: 'Candidates are temporarily unavailable.',
    note: 'not ranked; pay 0.025 USDC for the ranked recommendation with evidence' } });
  expect((result.data as { message: string }).message).toContain('pay 0.025 USDC');
});
