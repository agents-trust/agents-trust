# Agents Trust MCP server

A stdio MCP server for Agents Trust Recommend. It has two tools:

| Tool | Cost | What it does |
|---|---|---|
| `recommend` | 0.01 USDC per query, **only if you configured a wallet** | Finds ranked x402-paid APIs for a `need`. Without a wallet it returns the decoded payment quote and pays nothing. |
| `get_receipt` | free | Looks up the settlement state of a paid answer by `payment_attempt_id`. |

`recommend` takes `need` (required, 2-300 characters), `limit` (1-5),
`max_price_usd`, `chain` (CAIP-2, such as `eip155:8453`) and `view` (default
`compact`).

## Run

The committed bundle needs only Node 20 or newer, with no `npm install`:

```bash
node mcp/bundle/agents-trust-mcp.mjs
```

| Client | Setup |
|---|---|
| Claude Code | `claude plugin marketplace add agents-trust/agents-trust`, then `claude plugin install agents-trust@agents-trust` |
| Codex | `codex mcp add agents-trust -- node /path/to/agents-trust/mcp/bundle/agents-trust-mcp.mjs` |
| Cursor, Claude Desktop, others | `{"command": "node", "args": ["/path/to/agents-trust/mcp/bundle/agents-trust-mcp.mjs"]}` |

## Paying

The server never pays unless you give it your own wallet:

| Variable | Meaning |
|---|---|
| `AGENTS_TRUST_EVM_PRIVATE_KEY` | Your Base wallet key, holding USDC. Unset means quote-only. |
| `AGENTS_TRUST_MAX_FEE_USDC` | The highest fee the tool may sign for one query. Default `0.01`. Above it, nothing is signed. |
| `AGENTS_TRUST_API_BASE` | For testing only. Default `https://api.agents-trust.com`. With a key set, the server pays whichever host this names, still under the fee cap, so leave it unset. |

- **Payments are on Base (`eip155:8453`) only.**
- **The key stays in this process.** This code does not log or send it; only the x402 signature leaves your machine (see `src/index.ts`). Your MCP client stores the value you configure.
- **After a paid answer, use `get_receipt`.** The answer arrives before settlement. Never pay again because a receipt is `pending`.

## Develop

```bash
cd mcp && npm install
npm run build        # tsc -> dist/
npm run bundle       # esbuild -> bundle/agents-trust-mcp.mjs (commit it)
npm test             # unit tests, offline
npm run smoke        # live: tools/list, an unpaid quote, a demo need. Never pays.
```
