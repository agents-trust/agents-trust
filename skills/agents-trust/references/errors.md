# Agents Trust error responses

JSON errors share one shape:

```json
{ "error": { "code": "INVALID_PARAMETER", "message": "…", "parameter": "limit" }, "request_id": "<uuid>" }
```

Every response, errors included, carries an `x-at-request-id` header. Record it,
and quote it when you contact support. Validation errors are returned before
payment, so a 400 never costs anything.

| Status | `code` | Cause | Fix |
|---|---|---|---|
| 400 | `INVALID_PARAMETER` | `need` is empty, shorter than 2, longer than 300, or has fewer than 2 letters or digits. `limit` is outside 1-5. `chain` is not CAIP-2 (for example `base`). `live` is not 1. `view` is unknown. | Read `error.parameter` and fix that value. |
| 400 | `DUPLICATE_PARAMETER` | A parameter appears twice, as in `need=a&need=b`. | Send each one once. |
| 400 | `UNKNOWN_PARAMETER` | A name the route does not accept, for example `q=`. | The message lists the accepted names. |
| 400 | `INVALID_PAYMENT_ATTEMPT_ID` | `/receipt` was called without a valid payment-attempt id. Ids are UUIDv7, and a v4 UUID is rejected. | Pass the `x-at-payment-attempt-id` from the paid 200, unchanged. |
| 402 | (no body) | Payment required. The terms are in the `PAYMENT-REQUIRED` header. | See [payment-flow.md](payment-flow.md). |
| 402 | (no body) | The payment header was replayed, already claimed, expired, or did not match the challenge. | Do not pay again. Check `/receipt` first. |
| 404 | `RECEIPT_NOT_FOUND` | No receipt for this id yet. An unpaid challenge's id also has none. | Check that it came from a paid 200. |
| 404 | plain text `Not Found` | Unknown path. This is not the JSON shape. | Check the URL. |
| 405 | — | A method other than GET. The `allow` header is `GET, OPTIONS`. | Use GET. |
| 429 | — | Rate limited. | Wait for `Retry-After`. |
| 502 | `UPSTREAM_UNAVAILABLE` | A transient backend failure. | Retry once with backoff. |
| 503 | — | Evidence infrastructure is unavailable. | Retry later. |
| 403 | plain text `error code: 1010` | The edge blocks Python's built-in `urllib` default user agent. | Set a `User-Agent`, or use `requests` or `httpx`. |

A 200 with no picks is not an error. Read `meta.no_match_reason`; such a result
is not charged.
