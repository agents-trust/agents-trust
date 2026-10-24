import { it, expect, vi } from 'vitest';
import { generatePrivateKey } from 'viem/accounts';
import { AgentsTrustApi } from '../src/api.js';
import fixture from './fixtures/payment-required.json' with { type: 'json' };
const params = { need: 'weather' };
const challenge = () => new Response(null, { status: 402, headers: {
  'payment-required': Buffer.from(JSON.stringify({ ...fixture, resource: { ...fixture.resource, url: 'https://api.agents-trust.com/recommend?need=weather' } })).toString('base64'),
} });

it.each(['recommend', 'inspect'] as const)('labels real free %s results', async route => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ picks: [{ url: 'https://example.test' }] }));
  const api = new AgentsTrustApi({}, request);
  const result = route === 'recommend' ? await api.recommend(params) : await api.inspect({ url: 'https://example.test' });
  expect(result).toMatchObject({ payment: { state: 'free', fee_usdc: '0', attempt_id: null, receipt_tool: null } });
});
it('labels disabled-payment quotes distinctly', async () => {
  const result = await new AgentsTrustApi({}, vi.fn<typeof fetch>().mockResolvedValue(challenge())).recommend(params);
  expect(result).toMatchObject({ payment: { state: 'quote', fee_usdc: '0.01' }, data: { code: 'payments_disabled' } });
});
it.each([false, true])('labels a paid answer (settlement receipt %s) and preserves the one-use grant', async settled => {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(challenge())
    .mockResolvedValueOnce(Response.json({ picks: [{}] }, { headers: { 'x-at-payment-attempt-id': 'test-attempt', ...(settled ? { 'payment-response': 'receipt' } : {}) } }))
    .mockResolvedValueOnce(challenge());
  const api = new AgentsTrustApi({ enablePayments: true, walletKey: generatePrivateKey() }, request);
  expect(await api.recommend(params)).toMatchObject({ payment: { state: 'paid', fee_usdc: '0.01', attempt_id: 'test-attempt', receipt_tool: 'receipt', settlement: settled ? 'settled' : 'pending' },
    message: expect.stringContaining('paid 0.01 USDC, attempt test-attempt') });
  await expect(api.recommend(params)).rejects.toMatchObject({ code: 'authorization_consumed', message: expect.stringContaining('Start a fresh process') });
  expect(request).toHaveBeenCalledTimes(3);
});
it('labels the Worker verified empty answer uncharged', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(challenge())
    .mockResolvedValueOnce(Response.json({ picks: [] }, { headers: { 'x-at-payment-state': 'verified' } }));
  const result = await new AgentsTrustApi({ enablePayments: true, walletKey: generatePrivateKey() }, request).recommend(params);
  expect(result).toMatchObject({ payment: { state: 'free', settlement: 'not_required', fee_usdc: '0', attempt_id: null, receipt_tool: null },
    message: 'Authorization released, no fee.' });
});
it('reports the quoted price and cap without signing', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(challenge());
  const api = new AgentsTrustApi({ enablePayments: true, walletKey: generatePrivateKey(), maxCallUsdc: '0.001' }, request);
  await expect(api.recommend(params)).rejects.toMatchObject({ code: 'fee_cap_exceeded', message: expect.stringContaining('price 0.01 USDC > cap 0.001 USDC') });
  expect(request).toHaveBeenCalledTimes(1);
});
it('distinguishes a missing wallet from a consumed authorization', async () => {
  const api = new AgentsTrustApi({ enablePayments: true }, vi.fn<typeof fetch>().mockResolvedValue(challenge()));
  await expect(api.recommend(params)).rejects.toMatchObject({ code: 'payments_disabled' });
});

it('uses the quoted fee and never exposes a catalog preview from a quote body', async () => {
  const terms = structuredClone(fixture);
  terms.accepts[0]!.amount = '25000';
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ preview: { ranked: false, candidates: [{ name: 'must not leak' }] } }, {
    status: 402, headers: { 'payment-required': Buffer.from(JSON.stringify(terms)).toString('base64') },
  }));
  const result = await new AgentsTrustApi({}, request).recommend({ need: 'weather forecast' });
  expect(result).toMatchObject({ payment: { state: 'quote', fee_usdc: '0.025' }, data: { search_performed: false } });
  expect(result.data).not.toHaveProperty('preview');
  expect(JSON.stringify(result)).not.toContain('must not leak');
  expect(request).toHaveBeenCalledTimes(1);
});

it.each([{ picks: [] }, { picks: [{}] }])('keeps a signed 200 without a state header pending regardless of picks: $picks', async ({ picks }) => {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(challenge())
    .mockResolvedValueOnce(Response.json({ picks }, { headers: { 'x-at-payment-attempt-id': 'test-attempt' } }));
  const result = await new AgentsTrustApi({ enablePayments: true, walletKey: generatePrivateKey() }, request).recommend(params);
  expect(result).toMatchObject({ payment: { state: 'paid', fee_usdc: '0.01', settlement: 'pending',
    attempt_id: 'test-attempt', receipt_tool: 'receipt' } });
});
it('reports an uncertain payment after a signed non-2xx without inventing receipt access', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(challenge())
    .mockResolvedValueOnce(new Response(null, { status: 500 }));
  const api = new AgentsTrustApi({ enablePayments: true, walletKey: generatePrivateKey() }, request);
  await expect(api.recommend(params)).rejects.toMatchObject({
    message: expect.stringContaining('check wallet/receipt'),
    payment: { state: 'uncertain', fee_usdc: '0.01', settlement: 'pending', attempt_id: null, receipt_tool: null },
  });
  expect(request).toHaveBeenCalledTimes(2);
});
it('preserves the attempt ID when a charged response body is unreadable', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(challenge())
    .mockResolvedValueOnce(new Response('invalid json', { headers: { 'x-at-payment-attempt-id': 'recoverable-attempt' } }));
  const api = new AgentsTrustApi({ enablePayments: true, walletKey: generatePrivateKey() }, request);
  await expect(api.recommend(params)).rejects.toMatchObject({ payment: {
    state: 'paid', fee_usdc: '0.01', settlement: 'pending', attempt_id: 'recoverable-attempt', receipt_tool: 'receipt',
  } });
  expect(request).toHaveBeenCalledTimes(2);
});
