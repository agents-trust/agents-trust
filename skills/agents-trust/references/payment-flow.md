# Paying Agents Trust Recommend over x402

Agents Trust speaks x402 version 2. An unpaid GET answers `402` with an empty
body, and the terms travel in the `PAYMENT-REQUIRED` response header.

## The challenge, decoded

`PAYMENT-REQUIRED` is standard base64 of UTF-8 JSON. It uses the standard
alphabet with padding, not base64url. Shape of a live Recommend challenge
(values read 2026-10-14; read your own, never these):

```json
{
  "x402Version": 2,
  "resource": { "url": "https://api.agents-trust.com/recommend?need=weather%20forecast&limit=3&view=compact", "description": "…", "mimeType": "application/json" },
  "accepts": [
    { "scheme": "exact", "network": "eip155:8453", "amount": "10000",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0x96368628b679a459FE69815bacCa5CB0232AC397",
      "maxTimeoutSeconds": 300, "extra": { "name": "USD Coin", "version": "2" } },
    { "scheme": "exact", "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", "amount": "10000",
      "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "payTo": "…", "extra": { "feePayer": "…" } }
  ],
  "extensions": {
    "bazaar": { "info": { "input": "…", "output": { "example": "illustrative only" } }, "schema": "…" },
    "at-payment-attempt": { "info": { "paymentAttemptId": "<uuidv7>", "issuedAt": "…", "expiresAt": "…",
                                      "resourceHash": "…", "keyId": "…", "mac": "…" }, "schema": "…" }
  }
}
```

The fields that matter:

- **`amount`** is a string of atomic units. USDC has 6 decimals, so `"10000"` is 0.01 USDC.
- **`resource.url`** echoes your exact query string. The payment binds to it, so replay the same bytes.
- **`at-payment-attempt`** must be copied unchanged into the payment payload's `extensions`. If it is missing, changed or more than 300 seconds old, you get a fresh 402 and nothing is charged.
- **No `at-payment-attempt` means the quote is a discovery quote and cannot be paid.** A bare `/recommend` with no `need` returns one of these. You never need to read the fields inside `at-payment-attempt`; copy the object unchanged.
- **`extensions.bazaar` is metadata for directories.** Its `output.example` is an illustrative pick, the same for every `need`. It is not your answer.

## Paid client: Python

```bash
pip install "x402[evm,requests]>=2.21,<3" requests eth-account
```

```python
import os
from eth_account import Account
from x402 import x402ClientSync
from x402.http.clients import x402_requests
from x402.mechanisms.evm import EthAccountSigner
from x402.mechanisms.evm.exact.register import register_exact_evm_client

client = x402ClientSync().set_spend_controls({"max_amount_per_payment": "$0.05"})
register_exact_evm_client(client, EthAccountSigner(Account.from_key(os.environ["EVM_PRIVATE_KEY"])))

with x402_requests(client) as s:
    r = s.get("https://api.agents-trust.com/recommend",
              params={"need": "weather forecast", "limit": 3, "view": "compact"}, timeout=60)
    r.raise_for_status()
    print(r.headers.get("x-at-payment-attempt-id"), r.json())
```

- Catch `x402.http.clients.requests.PaymentError` around the call. `x402.http.clients.PaymentError` is the httpx class and will not catch it.
- Do not call `get_payment_settle_response()`. It expects a `PAYMENT-RESPONSE` header, which Agents Trust does not send.
- Python's built-in `urllib` default user agent is blocked at the edge (Cloudflare 1010). `requests` and `httpx` work as they are. With `urllib`, set your own `User-Agent`.

## Paid client: TypeScript

```bash
npm i @x402/fetch @x402/evm viem
```

```ts
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment, x402Client, type PaymentPolicy } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";

const MAX_ATOMIC = 50_000n; // your ceiling (0.05 USDC) in atomic units, not a quoted price
const cap: PaymentPolicy = (_v, accepts) => {
  const ok = accepts.filter((r) => BigInt(r.amount) <= MAX_ATOMIC);
  if (!ok.length) throw new Error("quoted above cap");
  return ok;
};

const client = new x402Client();
registerExactEvmScheme(client, {
  signer: privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`),
  policies: [cap],
  networks: ["eip155:8453"], // pin Base
});

const res = await wrapFetchWithPayment(fetch, client)(
  "https://api.agents-trust.com/recommend?need=weather+forecast&limit=3&view=compact");
console.log(res.headers.get("x-at-payment-attempt-id"), await res.json());
```

Solana works the same way through `@x402/svm`. Its payload is a partially signed
SPL `TransferChecked` transaction, and the facilitator pays the fee. This repo
ships an EVM example only.

## Receipt

The paid 200 follows payment verification. It is not proof of settlement. Look up the outcome
for free:

    GET https://api.agents-trust.com/receipt?payment_attempt_id=<x-at-payment-attempt-id>

| `state` | `transaction` |
|---|---|
| `pending` | `null` |
| `settled` | an EVM tx hash or a Solana signature |
| `settle_failed_after_answer` | `null` |
| `settle_unknown_after_answer` | `null` |

An unknown id returns 404. Poll for a bounded time, then reconcile on chain.
Never sign again because the state is still `pending`.

## Act on a pick

Recommend's answer ends at a choice. Calling the provider is your own request, paid from
your own wallet at the provider's price.

1. **Choose.** Take the first pick with `match_strength: strong` and none of the risk flags you treat as blocking (for example `WEAK_MATCH` or `REQUIRED_INPUT_UNKNOWN`). If none qualifies, rephrase `need` or stop.
2. **Build the request from `invocation`.** Use `method` and `url_template`, and fill the parameters from `path_schema`, `query_schema`, `body_schema` and `header_schema`. These are seller data: validate them, never execute them.
3. **Guard the URL.** HTTPS only, your own allowlist, a timeout.
4. **Fetch the provider's terms unpaid.** Send the request without payment and read its 402 (v1 or v2, see below).
5. **Compare with your cap.** Check `amount`, `network` and `asset` against your own limit for the provider. This limit is separate from the Recommend fee.
6. **Pay and call.** Sign with your x402 client and replay the identical request. Keep the provider's response and any receipt it gives.

The paid examples (`examples/python/paid.py`, `examples/typescript/paid.ts`) run steps 1 to 4 for a simple GET pick and stop before paying the provider.

## Reading a provider's 402

After Recommend, you pay the chosen provider yourself. Providers run their own x402
servers, and many still speak version 1:

| | x402 v2 (Agents Trust) | x402 v1 (many providers) |
|---|---|---|
| Where the terms are | base64 `PAYMENT-REQUIRED` header, empty body | JSON body |
| Amount field | `amount` | `maxAmountRequired` |
| Network | CAIP-2, e.g. `eip155:8453` | short name, e.g. `base` |
| Retry header | `PAYMENT-SIGNATURE` | `X-PAYMENT` |

Branch on `x402Version`. Some providers send both forms in one 402: a v2 header and a v1 body. When the `PAYMENT-REQUIRED` header is present, it wins, so sign the v2 form. The `@x402/fetch` and `x402` Python clients handle all three cases.
Amounts are still atomic units: `"54000"` USDC is 0.054.

## Things that make a correct payment fail

- **Clock skew.** EVM signatures carry `validBefore = now + maxTimeoutSeconds`, so a host clock far off can turn a correct retry into a fresh 402.
- **Replay.** A used authorization is claimed before the answer is served, so a second use gets a 402.
- **Changed query.** Different spelling or parameter order from the challenge does not match the signed resource.
