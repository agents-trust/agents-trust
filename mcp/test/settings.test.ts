import { expect, it } from 'vitest';
import { optionalLimit } from '../src/settings.js';
import { AgentsTrustApi } from '../src/api.js';

it.each(['AGENTS_TRUST_MAX_CALL_USDC', 'AGENTS_TRUST_SESSION_CAP_USDC'])('defaults optional %s placeholders safely', name => {
  for (const value of [undefined, '', '  ', '${' + name + '}']) {
    const limit = optionalLimit(value, name);
    expect(limit).toBeUndefined();
    expect(() => new AgentsTrustApi({ maxCallUsdc: limit, sessionCapUsdc: limit })).not.toThrow();
  }
  expect(optionalLimit('0.02', name)).toBe('0.02');
  for (const value of ['invalid', '-1', '${WRONG_NAME}']) {
    expect(() => new AgentsTrustApi({ maxCallUsdc: optionalLimit(value, name) })).toThrow('Invalid USDC limit');
  }
});
