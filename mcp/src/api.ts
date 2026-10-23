import { x402Client, x402HTTPClient } from '@x402/fetch';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';

const ORIGIN = 'https://api.agents-trust.com';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const PAYEE = '0x96368628b679a459fe69815bacca5cb0232ac397';

// Capability is separate from the owner's monetary caps and authorization grant.
function clientSupports(offer: PaymentRequirements): boolean {
  return offer?.scheme === 'exact' && offer.network === 'eip155:8453'
    && typeof offer.asset === 'string' && offer.asset.toLowerCase() === USDC
    && typeof offer.payTo === 'string' && offer.payTo.toLowerCase() === PAYEE
    && typeof offer.amount === 'string' && /^[1-9]\d*$/.test(offer.amount)
    && Number.isInteger(offer.maxTimeoutSeconds) && offer.maxTimeoutSeconds > 0 && offer.maxTimeoutSeconds <= 300
    && offer.extra?.name === 'USD Coin' && offer.extra?.version === '2'
    && (offer.extra?.assetTransferMethod === undefined || offer.extra.assetTransferMethod === 'eip3009');
}

const evidenceGuide = {
  delivery_verification: 'Read status first: pending, not_tested or null do not establish successful paid delivery; last_verified_at alone does not prove success.',
  PAID_DELIVERY_NOT_TESTED: 'Paid provider delivery has not been established; neither a challenge nor a stored timestamp proves it.',
  match_strength: 'strong/weak describe task fit, not guaranteed capability or paid delivery; WEAK_MATCH warns that the candidate may not fit.',
  risk_flags: 'Warnings to check before using a candidate; absence of a warning is not proof of success.',
  call_readiness: 'unknown or null means call requirements are not established; a missing required list does not prove every parameter is optional.',
  current_offer_match: 'Compare invocation.freshness.input_schema and output_schema separately: true matches that component to the current offer, false does not, null is unknown; none proves successful execution.',
  INVOCATION_CAPTURE_STALE: 'Check each schema component current_offer_match to identify the stale or unmatched capture; do not infer it from timestamps alone.',
  null: 'Unknown or unjudged, never zero, false or verified.',
  liveness: 'Reachability or payment-challenge evidence at the stated time, not proof of paid provider delivery.',
};
export type Settings = {
  walletKey?: string;
  enablePayments?: boolean;
  maxCallUsdc?: string;
  sessionCapUsdc?: string;
};

export function units(value: string): bigint {
  if (!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(value)) throw new Error('Invalid USDC limit; use up to six decimal places.');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole!) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

export class AgentsTrustApi {
  private spent = 0n;
  private authorizationUsed = false;
  private tail: Promise<unknown> = Promise.resolve();
  private readonly maxCall: bigint;
  private readonly sessionCap: bigint;

  constructor(private readonly settings: Settings = {}, private readonly request: typeof fetch = fetch) {
    this.maxCall = units(settings.maxCallUsdc ?? '0.01');
    this.sessionCap = units(settings.sessionCapUsdc ?? '0.01');
  }

  // Count every signing attempt conservatively, including failures and uncertain responses.
  recommend(params: Record<string, string | number | undefined>) {
    return this.paidCall('/recommend', params);
  }

  inspect(params: { url: string; view?: 'legacy' | 'compact' | 'evidence' }) {
    return this.paidCall('/inspect', params);
  }

  private paidCall(path: '/recommend' | '/inspect', params: Record<string, string | number | undefined>) {
    const task = this.tail.then(() => this.call(path, params, true));
    this.tail = task.catch(() => undefined);
    return task;
  }

  health() { return this.call('/health', {}); }
  receipt(paymentAttemptId: string) { return this.call('/receipt', { payment_attempt_id: paymentAttemptId }); }

  private select(required: PaymentRequired, url: string): PaymentRequirements {
    if (required.x402Version !== 2 || required.resource?.url !== url || !Array.isArray(required.accepts)) {
      throw new Error('Unsupported payment challenge. No payment sent.');
    }
    const offer = required.accepts.find(clientSupports);
    if (!offer) throw new Error('No supported Base USDC payment offer. No payment sent.');
    const amount = BigInt(offer.amount);
    if (amount > this.maxCall) throw new Error('Price exceeds AGENTS_TRUST_MAX_CALL_USDC. No payment sent.');
    if (this.spent + amount > this.sessionCap) throw new Error('Session spend cap reached. No payment sent.');
    return offer;
  }

  private async send(url: string, headers?: Record<string, string>) {
    return this.request(url, { headers, redirect: 'error', signal: AbortSignal.timeout(30_000) });
  }

  private async call(path: string, params: Record<string, string | number | undefined>, paid = false) {
    const url = new URL(path, ORIGIN);
    for (const [name, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(name, String(value));
    let response: Response;
    let paymentSubmitted = false;
    try { response = await this.send(url.href); }
    catch { throw new Error('Agents Trust request failed.'); }
    if (response.status === 402 && paid) {
      if (this.settings.enablePayments !== true) {
        let terms: PaymentRequired;
        try {
          terms = JSON.parse(Buffer.from(response.headers.get('payment-required') ?? '', 'base64').toString('utf8'));
          if (terms.x402Version !== 2 || !Array.isArray(terms.accepts)) throw new Error();
        } catch { throw new Error('Agents Trust returned an unreadable quote. No payment sent.'); }
        return {
          data: {
            mode: 'quote-only', outcome: 'payment_required', http_status: 402, url: url.href,
            payment_required: true, payment_submitted: false,
            provider_matches: 'unknown', filters_evaluated: false,
            ...(path === '/recommend' ? { search_performed: false } : {}),
            message: `${path === '/recommend'
              ? 'No search ran. No provider results yet. Payment is required to see matches; this quote does not establish that any provider matches your task or filters.'
              : 'No endpoint evidence returned yet. This is only an Inspect fee quote, not evidence about the provider.'} Payments disabled. The wallet owner must supply AGENTS_TRUST_WALLET_PRIVATE_KEY for a Base USDC wallet and AGENTS_TRUST_ENABLE_PAYMENTS=true for one authorization per process, within AGENTS_TRUST_MAX_CALL_USDC and AGENTS_TRUST_SESSION_CAP_USDC.`,
            client_payment_network: 'eip155:8453',
            offer_scope: 'Only offers supported by this Base USDC client are shown. These are Agents Trust fees, not provider prices. Support does not override owner opt-in or spend caps.',
            offers: terms.accepts.filter(clientSupports).map(offer => ({
              client_supported: true, decimals: 6,
              amount_usdc: `${BigInt(offer.amount) / 1_000_000n}.${(BigInt(offer.amount) % 1_000_000n).toString().padStart(6, '0')}`,
              scheme: offer.scheme, network: offer.network, asset: offer.asset,
              amount: offer.amount, payTo: offer.payTo, maxTimeoutSeconds: offer.maxTimeoutSeconds,
            })),
          },
          payment_attempt_id: null,
          request_id: response.headers.get('x-at-request-id'),
        };
      }
      if (this.authorizationUsed) throw new Error('Payment authorization already used in this process. Check your wallet and receipt before granting another process permission.');
      if (!this.settings.walletKey) throw new Error('Set AGENTS_TRUST_WALLET_PRIVATE_KEY to pay with Base USDC.');
      try {
        const account = privateKeyToAccount(this.settings.walletKey as `0x${string}`);
        const client = new x402Client().register('eip155:8453', new ExactEvmScheme(account));
        const http = new x402HTTPClient(client);
        const required = http.getPaymentRequiredResponse(name => response.headers.get(name));
        // Inspect quotes bind the canonical endpoint, without the response view.
        // Keep the original request URL for both HTTP requests.
        const endpoint = path === '/inspect' ? new URL(String(params.url)) : null;
        const resource = endpoint
          ? `${ORIGIN}/inspect?url=${encodeURIComponent(`${endpoint.protocol}//${endpoint.host}${endpoint.pathname}${endpoint.search}`)}`
          : url.href;
        const offer = this.select(required, resource);
        this.spent += BigInt(offer.amount);
        this.authorizationUsed = true;
        const payload = await http.createPaymentPayload({ ...required, accepts: [offer] });
        // Preserve the challenge extensions; never automatically retry an authorization.
        paymentSubmitted = true;
        response = await this.send(url.href, http.encodePaymentSignatureHeader(payload));
      } catch (error) {
        if (error instanceof Error && /^(Price exceeds|Session spend cap|No supported Base|Unsupported payment)/.test(error.message)) throw error;
        // Discard upstream error details: they can contain signing inputs.
        throw new Error('Payment could not complete. Budget remains reserved; check your wallet and receipt before another call.');
      }
    }
    // Only this unpaid semantic response is a normal lookup miss. Other HTTP,
    // transport and post-authorization failures retain the error path.
    if (path === '/inspect' && response.status === 404 && !paymentSubmitted) {
      const body: unknown = await response.clone().json().catch(() => null);
      if (body && typeof body === 'object' && 'error' in body) {
        const error = body.error;
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENDPOINT_NOT_INDEXED') {
          return {
            data: {
              outcome: 'not_found', http_status: 404, code: 'ENDPOINT_NOT_INDEXED',
              url: params.url, payment_required: false, payment_submitted: false,
              message: 'This exact endpoint URL is not indexed by Agents Trust. The lookup was free; no payment authorization was submitted and no provider was called. This says nothing about provider quality or availability and is not a service outage.',
            },
            payment_attempt_id: null,
            request_id: response.headers.get('x-at-request-id'),
          };
        }
      }
    }
    if (!response.ok) throw new Error(`Agents Trust returned HTTP ${response.status}. No automatic retry was made.`);
    try {
      const body: unknown = await response.json();
      return {
        data: body,
        ...(paid ? { evidence_guide: evidenceGuide } : {}),
        payment_attempt_id: response.headers.get('x-at-payment-attempt-id'),
        request_id: response.headers.get('x-at-request-id'),
      };
    } catch { throw new Error('Agents Trust returned an unreadable response. Check any payment receipt before another call.'); }
  }
}
