# Agent test: discovery from this repo alone (2026-10-14)

**Setup:**
- **Agents:** Claude Code 2.1.299 (`claude -p`) and Codex CLI 0.162.1 (`codex exec`), each given only a copy of this repo.
- **Wallet:** none in either environment, so no payment was possible.
- **Task:** use the repo to find a paid API for three needs: a 5-day weather forecast, English to German translation, and PDF text extraction. Make only unpaid calls. Report the exact URLs, the statuses, and every point of confusion.

## Results

| Run | Correct unpaid 402 read | Right params (`need`, `limit`, `view=compact`) | Paid or signed | Outcome |
|---|---|---|---|---|
| Claude Code, round 1 | yes, all 3 needs | yes | no | Quote for each need. Weather candidate found through the free `weather` demo, then priced from the provider's own 402. |
| Codex, round 1 | yes, all 3 needs | yes | no | Same result. |
| Claude Code, round 2 (after fixes) | yes | yes | no | Same, and it also read the v1 and dual-format provider 402s correctly. |
| Codex, round 2 (after fixes) | yes | yes | no | Same. It no longer confused the 402's illustrative example with an answer. |

Neither agent could complete translation or PDF discovery without paying. That is
the product working as designed: only three demo needs answer free, and the docs
now say so up front.

## Confusions found, and the fix in this repo

| Round | Confusion | Fix |
|---|---|---|
| 1 | No way to tell, without paying, whether a need has matches | "Without a wallet: what you can learn" table in `SKILL.md`, `README.md` |
| 1 | Demo picks have `selected_offer=null` and no live check | `response-fields.md`, `SKILL.md` |
| 1 | Provider 402s in x402 v1 (`maxAmountRequired`, `network: base`) | "Reading a provider's 402" in `payment-flow.md` |
| 1 | The `extensions.bazaar` example in the 402 looks like a real answer | Called out as illustrative in `SKILL.md`, `payment-flow.md`, `README.md` |
| 1 | Demo matching rule unclear | Case, spacing and punctuation are ignored (verified live) |
| 1 | `at-payment-attempt` fields undocumented | Full field list, plus "copy unchanged" |
| 2 | A provider sent a v2 header and a v1 body in the same 402 | The header wins (`payment-flow.md`) |
| 2 | `quote.sh` made a second request on a 200 and had no timeouts | One request, headers and body saved together, 10 s / 45 s timeouts |
| 2 | `delivery_verification` was undocumented | Documented in `response-fields.md` |
| 2 | OpenAPI's `live` text does not mention the demo picks | Noted in `response-fields.md` |

