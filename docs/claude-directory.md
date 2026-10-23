# Claude directory submission

Submit the reviewed readable plugin bundle at https://claude.ai/directory/manage.
The server runs locally over stdio; this repository does not offer a hosted
connector. Build `mcp/` in the installed checkout before enabling the plugin.

The README's “What the MCP integration runs and sends” section and the MCP
README's “Host installation and data disclosure” section are the runtime
disclosures. Include these with the submission:

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

Hans must obtain written paying-mode permission from directory@anthropic.com
before enabling that mode in the directory. A quote-only default, caps and a
published privacy notice do not establish that permission. This PR makes no
claim of directory submission, acceptance or policy approval. See the current
account checklist in https://github.com/agents-trust/agents-trust/issues/3.

Primary policy checked 2026-10-23:
https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy
(§3A privacy; §4A written permission for financial transactions).
