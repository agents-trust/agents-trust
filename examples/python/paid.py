"""PAID Recommend call: spends up to 0.01 USDC from YOUR wallet on Base.

pip install "x402[evm,requests]>=2.21,<3" requests eth-account
EVM_PRIVATE_KEY=0x... python paid.py "weather forecast"

The key comes from your environment or secret manager. Never commit it.
"""
import os
import sys

import requests

from eth_account import Account
from x402 import x402ClientSync
from x402.http.clients import x402_requests
from x402.http.clients.requests import PaymentError
from x402.mechanisms.evm import EthAccountSigner
from x402.mechanisms.evm.exact.register import register_exact_evm_client

need = sys.argv[1] if len(sys.argv) > 1 else "weather forecast"
client = x402ClientSync().set_spend_controls({"max_amount_per_payment": "$0.01"})
register_exact_evm_client(client, EthAccountSigner(Account.from_key(os.environ["EVM_PRIVATE_KEY"])))

try:
    with x402_requests(client) as s:
        r = s.get(
            "https://api.agents-trust.com/recommend",
            params={"need": need, "limit": 3, "view": "compact"},
            timeout=60,
        )
except PaymentError as e:
    sys.exit(f"payment not made: {e}")

print(r.status_code, "x-at-request-id:", r.headers.get("x-at-request-id"))
attempt = r.headers.get("x-at-payment-attempt-id")
print("payment_attempt_id:", attempt)
print(r.text[:2000])
if attempt:
    # The answer arrives before settlement; the receipt lookup is free. Never pay again while pending.
    print(requests.get("https://api.agents-trust.com/receipt",
                       params={"payment_attempt_id": attempt}, timeout=30).json())
