#!/usr/bin/env bash
# Unpaid Recommend call: prints the x402 payment terms and stops. Never pays.
# One request; headers and body come from the same exchange.
# Usage: ./quote.sh "weather forecast"
set -euo pipefail
need="${1:-weather forecast}"
url="https://api.agents-trust.com/recommend?need=$(jq -rn --arg v "$need" '$v|@uri')&limit=3&view=compact"

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
status=$(curl -sS --connect-timeout 10 --max-time 45 -D "$tmp/h" -o "$tmp/b" -w '%{http_code}' "$url")
echo "GET $url -> $status"
echo "x-at-request-id: $(grep -i '^x-at-request-id:' "$tmp/h" | cut -d' ' -f2 | tr -d '\r')"

if [ "$status" = 402 ]; then
  grep -i '^payment-required:' "$tmp/h" | cut -d' ' -f2 | tr -d '\r' | base64 -d |
    jq '{x402Version, resource: .resource.url, payable: (.extensions["at-payment-attempt"] != null),
         options: [.accepts[] | {network, amount_usdc: ((.amount|tonumber)/1e6), asset, payTo}]}'
  echo "Stopped before signing. Pay with an x402 v2 client and your own wallet (see ../python/paid.py, ../typescript/paid.ts)."
else
  jq . "$tmp/b"   # 200 = free demo need; 4xx = see skills/agents-trust/references/errors.md
fi
