# Claude integration disclosure

The server runs locally over stdio; this repository does not offer a hosted
connector. Build `mcp/` in the installed checkout before enabling the plugin.

The README's “What the MCP integration runs and sends” section and the MCP
README's “Host installation and data disclosure” section are the runtime
disclosures:

- Operator: Intentra Labs, Zug, Switzerland; hello@agents-trust.com.
- Terms: https://agents-trust.com/terms/; privacy: https://agents-trust.com/privacy/.
- Four tools: Recommend, Inspect, Receipt and Health. Quotes are the default even
  with a wallet configured. The fixed Recommend examples are `weather`,
  `crypto prices` and `web search`; quotes for other tasks contain no answer or
  open catalog preview.
- Local Node runs readable compiled files. Setup fetches locked npm dependencies;
  the runtime sends tasks, endpoint URLs, filters and attempt IDs to
  api.agents-trust.com. Hosting sees the client IP; the linked privacy notice
  describes logging and retention. The host controls its conversation logging.
- Optional paying mode signs a Base USDC authorization locally, under owner caps
  and a single authorization per process. It sends the signature to Agents Trust;
  settlement exposes on-chain addresses and amounts. The private key remains
  local. Provider calls and payments are separate and are never made by this MCP.
- Rankings are not paid placements. A fee does not buy a provider's position.
