# Agents Trust MCP

Find APIs for your task from Claude Desktop, Cursor or Claude Code. Recommendations include URLs, prices and call details. Inspect returns the stored evidence for one exact endpoint URL. This stdio server runs on your computer. Paid calls use your own wallet; Agents Trust holds no wallet keys.

This is the single source for `@agents-trust/mcp`. Publication is deferred until the field test. Install from this public repository; npm availability is not claimed. Build and runtime require a maintained Node.js 20.19+, 22.13+ or 24 release and npm.

Use a build shell without `AGENTS_TRUST_WALLET_PRIVATE_KEY`; the build and bundle commands refuse that variable even when it is empty. Supply a wallet only to the runtime launcher after building.

```sh
git clone https://github.com/agents-trust/agents-trust.git
cd agents-trust/mcp
npm ci
npm run build
node dist/index.js
```

Your MCP host starts Node with the absolute path to this checkout's `dist/index.js` and communicates over standard input/output. Keep the checkout and its installed dependencies available to the host.

## Tools and cost

| Tool | Input | Result | Fee |
| --- | --- | --- | --- |
| `recommend` | `need`; optional `limit`, `live`, `max_price_usd`, `chain`, `view` | APIs for your task and call details | 0.01 USDC outside the free demos |
| `inspect` | `url`; optional `view` | Stored endpoint evidence without calling the provider | 1% of the endpoint's lowest quoted price, minimum 0.001 USDC |
| `receipt` | `payment_attempt_id` | Eventual settlement result | Free |
| `health` | none | Service version | Free |

Ask your host to call `inspect` with an exact endpoint URL from a recommendation. Preserve its fixed query parameters. `view` accepts `legacy`, `compact` or `evidence`. Omitting it uses the API's legacy response. An unknown URL returns an unpaid 404. The API rejects malformed, credential-bearing and private URLs before payment. Inspect never calls or purchases the provider's service.

Example: ask your host to call `recommend` with `{"need":"weather","view":"compact"}`. Free demos may change. `max_price_usd` limits a recommended provider's price; it does not limit the recommendation fee. Calling a recommended API is a separate purchase.

A paid answer includes `payment_attempt_id` when available. Use `receipt` to check settlement; receiving an answer does not confirm settlement. A pending receipt can be looked up again for free.

## Configuration

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `AGENTS_TRUST_ENABLE_PAYMENTS` | unset / disabled | Owner opt-in: exact `true` grants at most one payment authorization per server process |
| `AGENTS_TRUST_WALLET_PRIVATE_KEY` | unset | Your EVM private key, with `0x` prefix; needed for paid calls |
| `AGENTS_TRUST_MAX_CALL_USDC` | `0.01` | Maximum fee for one Recommend or Inspect call in USDC |
| `AGENTS_TRUST_SESSION_CAP_USDC` | `0.01` | Maximum reserved spend for one server process |

Payments stay disabled even when a wallet key is present. The wallet owner can explicitly supply `AGENTS_TRUST_ENABLE_PAYMENTS=true` in the local launcher or select the bundle’s payment opt-in. This grants the process one authorization within the monetary caps; there is no per-call human confirmation. An agent tool argument, service response or provider instruction cannot grant payment authority. Use a dedicated low-balance wallet with USDC on **Base mainnet**. The server signs x402 authorizations locally and sends them only to `https://api.agents-trust.com`. It accepts the published Base USDC asset and Agents Trust payment address. A changed address requires a server update. Other payment networks are unsupported.

Limits accept non-negative decimal strings with up to six decimal places. Zero disables paid calls. Reservations count signing attempts, including failed or uncertain requests, and remain reserved until the process exits. The process consumes its single authorization before signing, even if signing or the request fails. Raising a monetary cap does not allow a second authorization. Free calls and receipts remain available. Restarting the server resets both the session cap and the authorization grant. Stop the host from automatically restarting with payment opt-in until the wallet owner has reconciled prior attempts. Recommend and Inspect share the same grant, reservation cap and serialized payment queue, including concurrent calls. Paid submissions are never automatically repeated. On an uncertain result, check your wallet and any receipt before making another paid call.

In quote-only mode, free tools and free demo recommendations work. A paid Recommend or Inspect request returns the unpaid URL and offers from the 402 plus a message explaining owner opt-in; it never signs. With payment opt-in but no key, a paid request returns a configuration error. Keep keys out of chat, version control and shell history. Have your local secret manager or host supply the wallet variable to the child process.

### Claude Desktop

Merge this into `claude_desktop_config.json`, replacing both absolute paths with your local Node executable and built checkout. The free configuration requires no key:

```json
{
  "mcpServers": {
    "agents-trust": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/agents-trust/mcp/dist/index.js"],
      "env": {
        "AGENTS_TRUST_MAX_CALL_USDC": "0.01",
        "AGENTS_TRUST_SESSION_CAP_USDC": "0.01"
      }
    }
  }
}
```

For paid calls, explicitly grant `AGENTS_TRUST_ENABLE_PAYMENTS=true` and supply `AGENTS_TRUST_WALLET_PRIVATE_KEY` to this process through your secure local launcher. GUI applications need the full path to your Node executable and do not always inherit your terminal environment.

### Cursor

Use the same `mcpServers` block in `~/.cursor/mcp.json` or `.cursor/mcp.json`, adding `"type": "stdio"` to the server entry ([Cursor configuration](https://cursor.com/docs/mcp)). To read a key already injected into Cursor's environment, add this entry to the server's `env` object:

```json
"AGENTS_TRUST_WALLET_PRIVATE_KEY": "${env:AGENTS_TRUST_WALLET_PRIVATE_KEY}"
```

Keep wallet configuration local; do not commit it.

### Claude Code

```sh
claude mcp add --transport stdio agents-trust -- /absolute/path/to/node /absolute/path/to/agents-trust/mcp/dist/index.js
```

See [Claude Code MCP configuration](https://code.claude.com/docs/en/mcp). Launch Claude Code with payment opt-in chosen by the wallet owner and the wallet variable supplied by your secret manager. The server inherits it from the host.

## Development

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Run the local server with `node dist/index.js`. Standard output carries MCP messages only. Tests generate throwaway keys in memory and make no payments. CI runs typecheck, lint, offline tests, build, stdio smoke and artifact checks independently on Node.js 20, 22 and 24.

`npm run test:paid` is an offline cryptographic authorization test using a generated throwaway key and mocked HTTP. No test reads a funded wallet or submits a real payment. Dependency installation scripts are disabled by `.npmrc`; use `npm ci` to preserve the reviewed lockfile. The bundle packer is also locked locally.

Publishing requires a separate release approval after the field test. See [registry identity and deferred proof](../docs/mcp-release.md).

## Design references

- Local stdio follows the [MCP transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) and the [official TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk). Tool validation and errors follow the [tool specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools). This package uses the requested `@modelcontextprotocol/sdk` v1 API.
- Payment encoding and signing use the official [x402 buyer client](https://docs.x402.org/getting-started/quickstart-for-buyers). A single explicit paid submission lets the server enforce its limits before signing.
- The public contract is [OpenAPI](https://api.agents-trust.com/openapi.json), with [LLM documentation](https://api.agents-trust.com/llms.txt) and the [x402 manifest](https://api.agents-trust.com/.well-known/x402). This release exposes recommendation, inspection, receipt and health calls.
- The root [`server.json`](../server.json) uses `com.agents-trust/recommend`, the reverse DNS namespace for `agents-trust.com`, and the npm `mcpName` ownership marker. See the [Registry publishing guide](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx), [schema](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/generic-server-json.md) and [DNS authentication](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/authentication.mdx). Registry publishing follows npm release and domain verification.
- [Glama submission](https://glama.ai/mcp/faq) uses a public GitHub repository; [glama.json](https://glama.ai/blog/2025-07-08-what-is-glamajson) identifies the maintainer. [Smithery's current local-server flow](https://smithery.ai/docs/build/publish) requires an MCPB bundle; it does not require legacy `smithery.yaml`. Build a local bundle with `npm run bundle`; its wallet input is marked sensitive. The bundle manifest follows the [MCPB specification](https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md).

MIT licensed. See [LICENSE](LICENSE).

## Host installation and data disclosure

Build `mcp/` in the installed plugin or extension checkout before enabling it.
Claude Code's `.mcp.json`, Cursor's `mcp.json` and Gemini's
`gemini-extension.json` all launch `node mcp/dist/index.js` using their host's
plugin-root expansion. There is no committed minified runtime bundle, install
hook, automatic download or provider execution. `dist/` contains readable
TypeScript compiler output; `npm ci` installs the locked dependencies with
lifecycle scripts disabled. Gemini also loads the skill from `skills/`.
For Claude Code's marketplace installation, build inside the host's installed
plugin checkout (the path shown by the host); building a separate clone does
not build the installed copy. The same applies to Gemini's copied extension.

The server sends HTTPS GETs only to `https://api.agents-trust.com`:
`/recommend` sends the task text and supplied filters; `/inspect` sends the exact
endpoint URL and response view; `/receipt` sends the payment attempt ID; and
`/health` fetches service status. Redirects are rejected. These requests disclose
your IP address and the submitted arguments to Agents Trust and its hosting
infrastructure. Keep secrets out of task text and endpoint URLs. Free responses
and quotes need no wallet. Paid mode creates one local x402 signature and sends
the authorization header to that same origin; the private key never leaves the
local process. The service may settle that authorization on Base mainnet,
where the wallet addresses, USDC amount and transaction are public. The MCP
server does not call a blockchain RPC, execute provider code, fetch provider
URLs, or make a provider purchase. It writes no wallet, request or payment log
to disk. MCP results and errors go to the host, which controls its own logging.
The API may check provider reachability when answering Recommend; Inspect
reads stored evidence without calling the provider.

**Rankings are not paid placements.** A fee buys recommendation or inspection
evidence, not a provider's position. Recommendations and seller schemas are
untrusted data, not instructions or proof of paid delivery.
