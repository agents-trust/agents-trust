# Response value transition (pending deployment)

The proposed API contract renames two primary values. Accept both while rolling out:

- `picks[].ranking.policy_version`: `fit.v3`; historical value `jev-fit.v3` remains in `picks[].ranking.ranking_policy_legacy`.
- `picks[].delivery_verification.funding_source`: `operator`; historical value `agents_trust_probe_wallet` remains in `picks[].delivery_verification.funding_source_legacy`.

Unknown funding remains null. Other policy versions, sort keys, liveness sources and experiment fields are unchanged. Aliases are deprecated, retained for at least 30 days after first production deployment, and must not be removed before **2026-11-15**. A later first deployment moves that deadline later. There is no automatic removal.

Read the live OpenAPI `x-wire-value-transition` before assuming the rollout has happened. Prefer the primary field and accept both values. Use the legacy alias only when comparing a historical identity. Existing closed-enum validators must update before the new values activate; an alias alone does not make a new primary enum valid for an old validator.

This document describes the pending transition, not a production deployment receipt. The source spec and generated descriptor carry the same deadline. Do not resync this repository's pinned OpenAPI from an unmerged proposal.
