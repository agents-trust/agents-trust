// Live smoke test over stdio. Runs WITHOUT a wallet, so it can never pay.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import assert from "node:assert/strict";

const env = { ...process.env };
delete env.AGENTS_TRUST_EVM_PRIVATE_KEY;
const transport = new StdioClientTransport({ command: "node", args: [process.env.SMOKE_ENTRY ?? "bundle/agents-trust-mcp.mjs"], env });
const client = new Client({ name: "smoke", version: "0" });
await client.connect(transport);

const tools = (await client.listTools()).tools.map((t) => t.name).sort();
assert.deepEqual(tools, ["get_receipt", "recommend"]);

const parse = (r) => JSON.parse(r.content[0].text);
const quote = parse(await client.callTool({ name: "recommend", arguments: { need: "weather forecast", limit: 3 } }));
assert.equal(quote.status, "payment_required");
assert.equal(quote.paid, false);
assert.ok(quote.quote.payable, "quote must carry at-payment-attempt");
assert.ok(quote.quote.options.some((o) => o.network === "eip155:8453"));

const bad = await client.callTool({ name: "recommend", arguments: { need: "weather forecast", chain: "base" } });
assert.equal(bad.isError, true, "chain=base must be rejected");

const demo = parse(await client.callTool({ name: "recommend", arguments: { need: "weather" } }));
assert.equal(demo.status, 200);
assert.equal(demo.paid, false);

console.log("smoke ok:", tools.join(","), "| quote", quote.quote.options.map((o) => `${o.network}=${o.amount_usdc}`).join(" "), "| demo picks", JSON.stringify(demo.result).length, "bytes");
await client.close();
