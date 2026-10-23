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
it('labels a paid success with its fee, attempt and receipt tool and preserves the one-use grant', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(challenge())
    .mockResolvedValueOnce(Response.json({ picks: [{}] }, { headers: { 'x-at-payment-attempt-id': 'test-attempt', 'x-at-payment-state': 'settled' } }))
    .mockResolvedValueOnce(challenge());
  const api = new AgentsTrustApi({ enablePayments: true, walletKey: generatePrivateKey() }, request);
  expect(await api.recommend(params)).toMatchObject({ payment: { state: 'paid', fee_usdc: '0.01', attempt_id: 'test-attempt', receipt_tool: 'receipt' },
    message: 'paid 0.01 USDC, attempt test-attempt' });
  await expect(api.recommend(params)).rejects.toMatchObject({ code: 'authorization_consumed', message: expect.stringContaining('Start a fresh process') });
  expect(request).toHaveBeenCalledTimes(3);
});
it('labels an authorized but unsettled empty answer free', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(challenge())
    .mockResolvedValueOnce(Response.json({ picks: [] }, { headers: { 'x-at-payment-state': 'verified' } }));
  const result = await new AgentsTrustApi({ enablePayments: true, walletKey: generatePrivateKey() }, request).recommend(params);
  expect(result).toMatchObject({ payment: { state: 'free', fee_usdc: '0' } });
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
