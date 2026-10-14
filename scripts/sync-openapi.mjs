// Regenerates ./openapi.json from the live public spec, keeping only the routes
// this repo documents. `--check` exits 1 if the committed file is stale.
import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "https://api.agents-trust.com/openapi.json";
const KEEP = ["/recommend", "/receipt", "/health"];
const OUT = new URL("../openapi.json", import.meta.url);

const spec = await (await fetch(SOURCE, { headers: { "user-agent": "agents-trust-repo-sync" } })).json();
spec.paths = Object.fromEntries(KEEP.filter((p) => spec.paths[p]).map((p) => [p, spec.paths[p]]));

// Keep only component schemas reachable from the kept paths.
const schemas = spec.components?.schemas ?? {};
const reached = new Set();
const walk = (node) => {
  if (Array.isArray(node)) return node.forEach(walk);
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (k === "$ref" && typeof v === "string" && v.startsWith("#/components/schemas/")) {
      const name = v.slice("#/components/schemas/".length);
      if (!reached.has(name)) { reached.add(name); walk(schemas[name]); }
    } else walk(v);
  }
};
walk(spec.paths);
spec.components.schemas = Object.fromEntries(Object.entries(schemas).filter(([n]) => reached.has(n)));

const text = JSON.stringify(spec, null, 2) + "\n";
if (process.argv.includes("--check")) {
  const current = readFileSync(OUT, "utf8");
  if (current !== text) { console.error("openapi.json is stale: run node scripts/sync-openapi.mjs"); process.exit(1); }
  console.log("openapi.json matches the live spec");
} else {
  writeFileSync(OUT, text);
  console.log(`openapi.json: ${Object.keys(spec.paths).join(", ")}; ${reached.size} schemas; ${text.length} bytes`);
}
