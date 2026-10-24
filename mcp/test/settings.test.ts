import { expect, it } from 'vitest';
import { optionalSetting, settingsFromEnv } from '../src/settings.js';
import { AgentsTrustApi } from '../src/api.js';

it.each(['AGENTS_TRUST_MAX_CALL_USDC', 'AGENTS_TRUST_SESSION_CAP_USDC'])('defaults optional %s placeholders safely', name => {
  for (const value of [undefined, '', '  ', '${' + name + '}']) {
    const limit = optionalSetting(value, name);
    expect(limit).toBeUndefined();
    expect(() => new AgentsTrustApi({ maxCallUsdc: limit, sessionCapUsdc: limit })).not.toThrow();
  }
  expect(optionalSetting('0.02', name)).toBe('0.02');
  for (const value of ['invalid', '-1', '${WRONG_NAME}']) {
    expect(() => new AgentsTrustApi({ maxCallUsdc: optionalSetting(value, name) })).toThrow('Invalid USDC limit');
  }
});

it.each([undefined, '', '  ', '${AGENTS_TRUST_WALLET_PRIVATE_KEY}'])('keeps payments disabled with an absent or unexpanded wallet setting', async value => {
  const fixture = (await import('./fixtures/payment-required.json', { with: { type: 'json' } })).default;
  const request: typeof fetch = async () => new Response(null, { status: 402, headers: {
    'payment-required': Buffer.from(JSON.stringify({ ...fixture, resource: { ...fixture.resource,
      url: 'https://api.agents-trust.com/recommend?need=weather' } })).toString('base64'),
  } });
  const settings = settingsFromEnv({ AGENTS_TRUST_ENABLE_PAYMENTS: 'true', AGENTS_TRUST_WALLET_PRIVATE_KEY: value });
  expect(settings.walletKey).toBeUndefined();
  expect(settings.enablePayments).toBe(false);
  const result = await new AgentsTrustApi(settings, request).recommend({ need: 'weather' });
  expect(result).toMatchObject({ data: { mode: 'quote-only', payment_submitted: false, message: expect.stringContaining('Payments disabled') } });
});
