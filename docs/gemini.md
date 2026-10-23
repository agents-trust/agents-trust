# Gemini CLI installation

Clone this repository and build its readable local MCP server before linking:

```bash
git clone https://github.com/agents-trust/agents-trust
cd agents-trust/mcp
npm ci
npm run build
cd ..
gemini extensions link .
```

For a repository installation use `gemini extensions install https://github.com/agents-trust/agents-trust`, then build `mcp/` in that installed checkout before enabling it. The extension launches Node at `${extensionPath}/mcp/dist/index.js` and discovers the `skills/agents-trust` skill.

Four tools: Recommend, Inspect, Receipt and Health. Quotes are the default even
with a wallet configured. Only the three documented demo needs return free
Recommend answers. There is no open catalog preview. Configuring paid mode
requires the wallet owner's explicit one-authorization grant and caps as described
in [the MCP setup](../mcp/README.md); do not enable it for unattended work.

The extension sends task text, endpoint URLs and payment-attempt identifiers to
api.agents-trust.com. [Terms](https://agents-trust.com/terms/) and
[privacy](https://agents-trust.com/privacy/) apply. It never pays a provider.

The repository topic `gemini-cli-extension` makes it eligible for the gallery's
crawler; a topic is not proof of gallery acceptance or search rank.

Sources checked 2026-10-23: [Gemini extension reference](https://geminicli.com/docs/extensions/reference/),
[release and gallery rules](https://geminicli.com/docs/extensions/releasing/).
