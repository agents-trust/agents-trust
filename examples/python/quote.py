"""Unpaid Recommend call: prints the x402 payment terms and stops. Never pays.

pip install requests
python quote.py "weather forecast"
"""
import base64
import json
import sys

import requests  # urllib's default User-Agent is blocked at the edge (Cloudflare 1010)

need = sys.argv[1] if len(sys.argv) > 1 else "weather forecast"
r = requests.get(
    "https://api.agents-trust.com/recommend",
    params={"need": need, "limit": 3, "view": "compact"},
    timeout=30,
)
print(r.status_code, r.url, "x-at-request-id:", r.headers.get("x-at-request-id"))

if r.status_code == 402:
    terms = json.loads(base64.b64decode(r.headers["PAYMENT-REQUIRED"]))
    print(json.dumps({
        "x402Version": terms["x402Version"],
        "payable": "at-payment-attempt" in terms.get("extensions", {}),
        "options": [
            {"network": a["network"], "amount_usdc": int(a["amount"]) / 1e6, "payTo": a["payTo"]}
            for a in terms["accepts"]
        ],
    }, indent=2))
    print("Stopped before signing. See paid.py to pay with your own wallet.")
else:
    print(json.dumps(r.json(), indent=2)[:2000])
