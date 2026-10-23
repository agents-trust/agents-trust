# MCP consolidation and release handoff

The public `mcp/` replaces the old bundled copy with source from private
`agents-trust/agents-trust-mcp` commit
`a7cb5da679c1a32349e6aa59661f8c50a830ba9e`, imported without its Git history.
Payment caps, the one-authorization process grant, conservative reservations,
serialized Recommend/Inspect payments, pinned Base USDC/payee validation,
no automatic paid retry, and wallet-bearing build refusal are retained.
Quote-only returns the unpaid offer and never signs. Both tool schemas reject
the diagnostic view. The old minified bundle is removed.

## Identity recommendation and proof

Recommend **`com.agents-trust/recommend`**: ownership follows the service domain
rather than an individual GitHub account's organization role. `mcpName` in
`mcp/package.json` matches the single root `server.json`; the npm name is
`@agents-trust/mcp`. The repository and subfolder point to this public repo.
There is no second registry file in the package.

After merge and the field test, Hans can authorize release. For domain proof:

1. With OpenSSL 3, generate an Ed25519 publisher key into protected local storage
   (`openssl genpkey -algorithm Ed25519 -out /secure/path/mcp-publisher.pem`;
   apply owner-only file permissions). Never print or commit the private key.
2. Derive its public key as the base64-encoded final 32 bytes of
   `openssl pkey -in /secure/path/mcp-publisher.pem -pubout -outform DER`.
3. Set an apex TXT record at **`agents-trust.com`** (Cloudflare name `@`) with
   content `v=MCPv1; k=ed25519; p=<base64-public-key>`. Do not use a selector
   subdomain. Check the public DNS TXT response contains the exact proof.
4. From the repo root authenticate using
   `mcp-publisher login dns --domain agents-trust.com --private-key <injected-ed25519-private-key-hex>`.
   Use a secure launcher to inject the raw key from protected storage without
   displaying it; the CLI uses `--private-key`, not a PEM-file flag.
   Confirm the resulting publisher namespace is `com.agents-trust`.
5. Only with release authorization, build and publish npm from `mcp/`, then
   publish the root registry file. No account/login/proof/publish command was
   executed by this pack.

Alternative: `io.github.agents-trust/agents-trust` requires changing both names
and running `mcp-publisher login github` as an agents-trust organization **Owner**.
Ordinary membership is insufficient. DNS is recommended; no DNS record is set
before merge.

Source: [official registry authentication](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/authentication.mdx).

## Store packaging and remaining account actions

- Gemini discovers `skills/` and launches the built server using `${extensionPath}`.
  [Extension reference](https://geminicli.com/docs/extensions/reference/).
- Cursor declares its wallet, two caps and explicit payment grant in the manifest's
  JSON Schema `variables`; `mcp.json` uses `${CURSOR_PLUGIN_ROOT}` and matching
  placeholders. [Plugin reference](https://cursor.com/docs/reference/plugins).
- Claude's launcher and optional configuration use the hardened variable names,
  the readable build, and a disabled payment default. Build inside the installed
  plugin checkout before enabling it.
- ClawHub skill metadata declares optional runtime variables under
  `metadata.openclaw.envVars`; the skill has no `license: MIT` frontmatter.
- CI checks Node 20/22/24 without a wallet, live payment or opt-in paid test.
  `npm run test:paid` is a separate **offline** cryptographic test with a generated
  throwaway key and mocked HTTP. It makes no payment and reads no wallet variable.

Store login/submission, domain proof, npm and registry publication, repository
settings/topics and private-repo archival remain Hans's later actions. Terms,
privacy/operator pages, Anthropic permission for the paying mode and a Hermes
per-payment approval integration remain account/product prerequisites from
[issue #3](https://github.com/agents-trust/agents-trust/issues/3); this PR does
not claim store acceptance or replace those decisions. Field test first.
