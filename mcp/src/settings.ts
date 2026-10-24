// Plugin hosts may forward optional settings as empty or unexpanded placeholders.
export function optionalSetting(value: string | undefined, name: string): string | undefined {
  if (value === undefined || value.trim() === '' || value === '${' + name + '}') return undefined;
  return value;
}

export function settingsFromEnv(source: Record<string, string | undefined>) {
  const walletKey = optionalSetting(source.AGENTS_TRUST_WALLET_PRIVATE_KEY, 'AGENTS_TRUST_WALLET_PRIVATE_KEY');
  return {
    enablePayments: source.AGENTS_TRUST_ENABLE_PAYMENTS === 'true' && walletKey !== undefined,
    walletKey,
    maxCallUsdc: optionalSetting(source.AGENTS_TRUST_MAX_CALL_USDC, 'AGENTS_TRUST_MAX_CALL_USDC'),
    sessionCapUsdc: optionalSetting(source.AGENTS_TRUST_SESSION_CAP_USDC, 'AGENTS_TRUST_SESSION_CAP_USDC'),
  };
}
