# Agents Trust portable Hermes plugin

This Agent Plugins v1 package supplies an MCP launcher and a focused API-choice
skill. It starts the separately installed `agents-trust-mcp` executable; it
never downloads or installs code at runtime. This launcher supports Linux and macOS; Node20.19+, 22.13+ or24 is required.

## Install

The npm package is not published yet. For current source testing, build `mcp/`
from the reviewed public repository, run `npm pack`, and install that tarball
with `npm install --global /absolute/path/to/agents-trust-mcp-0.1.0.tgz`.
After a reviewed npm release exists, install its exact version with
`npm install --global @agents-trust/mcp@0.1.0`. Do not run that command expecting
an unpublished version to exist. Both commands fetch locked runtime dependencies.

Install the plugin separately:

```bash
hermes plugins install agents-trust/agents-trust/agent-plugins/agents-trust --no-enable
hermes plugins validate agents-trust
hermes plugins enable agents-trust
```

Restart the session or reload MCP. The server is offered only when
`agents-trust-mcp` is on PATH. Verify the package's reviewed commit before
installing; a future catalog entry must pin its full 40-character SHA.

## Consent and data

Quotes are the default, including with a wallet present. The owner may supply
AGENTS_TRUST_WALLET_PRIVATE_KEY and explicitly grant
AGENTS_TRUST_ENABLE_PAYMENTS=true, with AGENTS_TRUST_MAX_CALL_USDC and
AGENTS_TRUST_SESSION_CAP_USDC (both default0.01). Never put keys in this package.
Hermes forwards only the declared optional variables. The plugin marks its
server `untrusted`; Recommend/Inspect declare `readOnlyHint: false`, so Hermes
asks before every such call, including quote calls. Read the live quote first
in quote-only mode, then approve a paying call under an explicit fee cap.
Unattended contexts without an approval surface must not pay. A native
same-name server config can override plugin trust; do not override this guard.

One owner grant permits one authorization per process. There is no automatic
retry. Check receipt and wallet after uncertain outcomes before authorizing
another process. The local key signs Base USDC authorizations; it is never sent
to Agents Trust. Settlement makes on-chain wallet addresses and amount public.
The server sends task/filter text, endpoint URLs and attempt IDs to
api.agents-trust.com; hosting sees the client IP. It never calls or pays
providers and writes no request/wallet logs; Hermes controls conversation logs.
No telemetry is added by the launcher. The three fixed demo needs are free;
other tasks return quotes without an open catalog preview. Rankings are not
paid placements. [Terms](https://agents-trust.com/terms/) ·
[privacy](https://agents-trust.com/privacy/).

Format: https://agent-plugins.org/specification
Hermes approval semantics:
https://hermes-agent.nousresearch.com/docs/reference/mcp-config-reference/

This PR prepares the package; it does not submit to the Hermes catalog,
publish npm, install into a user's profile or enable a wallet.
