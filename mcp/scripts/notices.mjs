// Writes bundle/THIRD_PARTY_NOTICES.txt: the license text of every package
// esbuild put into the bundle. Their licenses require these notices to travel
// with the redistributed code. Run after `npm run bundle`, which writes the
// metafile this reads.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const meta = JSON.parse(readFileSync("node_modules/.bundle-meta.json", "utf8"));
const dirs = new Set();
for (const input of Object.keys(meta.inputs)) {
  const m = input.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);
  if (m) dirs.add(m[1]);
}

// Packages published without a license file. Their text is vendored from the
// source repo their package.json names (licenses/).
const VENDORED = {
  "https://github.com/x402-foundation/x402": ["licenses/x402-foundation-x402.NOTICE", "licenses/x402-foundation-x402.LICENSE"],
};

const out = [];
const missing = [];
for (const dir of [...dirs].sort()) {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  const repo = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  const texts = file ? [join(dir, file)] : VENDORED[repo];
  if (!texts) {
    missing.push(`${pkg.name}@${pkg.version}`);
    continue;
  }
  const body = texts.map((t) => readFileSync(t, "utf8").trim()).join("\n\n");
  out.push(`${pkg.name}@${pkg.version} (${pkg.license ?? "see text"})\n\n${body}\n`);
}

if (missing.length) {
  console.error(`no license file in: ${missing.join(", ")}`);
  process.exit(1);
}
const header = "Third-party software bundled into agents-trust-mcp.mjs, with its license text.\n";
writeFileSync(join("bundle", "THIRD_PARTY_NOTICES.txt"), [header, ...out].join("\n" + "-".repeat(72) + "\n\n"));
console.log(`${out.length} packages`);
if (!existsSync(join("bundle", "THIRD_PARTY_NOTICES.txt"))) process.exit(1);
