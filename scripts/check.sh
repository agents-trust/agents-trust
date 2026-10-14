#!/usr/bin/env bash
# Repo checks. Live calls are unpaid only: no wallet key is ever passed.
set -euo pipefail
cd "$(dirname "$0")/.."
unset AGENTS_TRUST_EVM_PRIVATE_KEY EVM_PRIVATE_KEY

echo "== skill frontmatter (agentskills.io spec)"
python3 - <<'PY'
import re, pathlib
for f in pathlib.Path("skills").glob("*/SKILL.md"):
    text = f.read_text()
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S); assert m, f"{f}: no frontmatter"
    fm = dict(re.findall(r"^(\w[\w-]*):\s*(.*)$", m.group(1), re.M))
    assert fm.get("name") == f.parent.name, f"{f}: name must equal directory"
    assert re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", fm["name"]) and len(fm["name"]) <= 64
    assert 1 <= len(fm.get("description", "")) <= 1024, f"{f}: description length"
    lines = text.count("\n"); assert lines < 500, f"{f}: {lines} lines"
    print(f"ok {f}: {lines} lines, {len(text.encode())} bytes, description {len(fm['description'])} chars")
PY

echo "== relative links resolve"
python3 - <<'PY'
import re, pathlib, sys
bad = []
for f in pathlib.Path(".").rglob("*.md"):
    if "node_modules" in f.parts: continue
    for link in re.findall(r"\]\(([^)#]+)\)", f.read_text()):
        if "://" in link or link.startswith("mailto:"): continue
        if not (f.parent / link).exists(): bad.append(f"{f}: {link}")
print("\n".join(bad) or "ok"); sys.exit(1 if bad else 0)
PY

echo "== plugin + marketplace manifests"
if command -v claude >/dev/null; then
  claude plugin validate .claude-plugin/plugin.json | tail -1
  claude plugin validate . | tail -1
else
  echo "skipped: claude CLI not installed"
fi

echo "== openapi.json matches live spec"
node scripts/sync-openapi.mjs --check

echo "== MCP: unit tests, bundle freshness, live smoke (unpaid)"
[ -d mcp/node_modules ] || (cd mcp && npm ci --silent)
log=$(cd mcp && npm run --silent build && npm test --silent 2>&1) || { echo "$log"; exit 1; }
grep -E '^ℹ (pass|fail)' <<<"$log"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
(cd mcp && cp bundle/agents-trust-mcp.mjs "$tmp/bundle.mjs" && cp bundle/THIRD_PARTY_NOTICES.txt "$tmp/notices.txt" \
  && npm run --silent bundle >/dev/null && cmp -s bundle/agents-trust-mcp.mjs "$tmp/bundle.mjs" && cmp -s bundle/THIRD_PARTY_NOTICES.txt "$tmp/notices.txt" \
  && echo "bundle and third-party notices up to date" || { echo "bundle or notices were stale: rebuilt, commit them"; exit 1; })
(cd mcp && npm run --silent smoke 2>/dev/null)

echo "== examples: unpaid quotes"
expect_payable() { # name, output
  if grep -q '"payable": true' <<<"$2"; then echo "$1 ok"; else echo "$1 FAILED"; echo "$2" | head -5; exit 1; fi
}
expect_payable curl "$(examples/curl/quote.sh "weather forecast")"
expect_payable typescript "$(cd examples/typescript && node quote.ts "weather forecast")"
if python3 -c 'import requests' 2>/dev/null; then
  expect_payable python "$(python3 examples/python/quote.py "weather forecast")"
else
  echo "python FAILED: requests not installed (pip install requests)"; exit 1
fi

echo "== live behaviors the docs describe"
# A failure here means the API changed under the docs: update README.md,
# SKILL.md and references/ to match, then this check.
python3 - <<'PY'
import base64, json, sys, requests
API = "https://api.agents-trust.com/recommend"
bad = []
r = requests.get(API, timeout=45)
terms = json.loads(base64.b64decode(r.headers.get("payment-required", ""))) if r.status_code == 402 else {}
if r.status_code != 402 or "at-payment-attempt" in terms.get("extensions", {}):
    bad.append(f"bare /recommend: docs say unpayable 402, got {r.status_code}"
               f"{' with at-payment-attempt' if r.status_code == 402 else ''}")
for need in ("weather", "Web-Search"):
    r = requests.get(API, params={"need": need, "limit": 1, "view": "compact"}, timeout=45)
    if r.status_code != 200:
        bad.append(f"demo need {need!r}: docs say free 200, got {r.status_code}")
print("\n".join(bad) or "ok: bare /recommend unpayable 402; demo needs free"); sys.exit(1 if bad else 0)
PY
echo "ALL CHECKS PASSED"
