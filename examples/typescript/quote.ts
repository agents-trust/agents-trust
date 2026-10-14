// Unpaid Recommend call: prints the x402 payment terms and stops. Never pays.
// Node 22.18+ (or 23.6+) runs this directly: node quote.ts "weather forecast"
const need = process.argv[2] ?? "weather forecast";
const url = new URL("https://api.agents-trust.com/recommend");
url.search = new URLSearchParams({ need, limit: "3", view: "compact" }).toString();

const res = await fetch(url);
console.log(res.status, url.href, "x-at-request-id:", res.headers.get("x-at-request-id"));

if (res.status === 402) {
  const terms = JSON.parse(Buffer.from(res.headers.get("payment-required")!, "base64").toString("utf8"));
  console.log(JSON.stringify({
    x402Version: terms.x402Version,
    payable: Boolean(terms.extensions?.["at-payment-attempt"]),
    options: terms.accepts.map((a: any) => ({ network: a.network, amount_usdc: Number(a.amount) / 1e6, payTo: a.payTo })),
  }, null, 2));
  console.log("Stopped before signing. See paid.ts to pay with your own wallet.");
} else {
  console.log(JSON.stringify(await res.json(), null, 2).slice(0, 2000));
}
