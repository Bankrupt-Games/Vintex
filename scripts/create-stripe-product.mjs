const secretKey = process.env.STRIPE_SECRET_KEY;
const apiVersion = process.env.STRIPE_API_VERSION ?? "2026-03-04.preview";

if (!secretKey?.startsWith("sk_")) {
  console.error("Set STRIPE_SECRET_KEY to a Stripe test secret key before running this script.");
  process.exit(1);
}

const form = new URLSearchParams({
  name: "Vintex Basic subscription",
  description: "5,000 monthly Vintex validation credits, 4 seats, and protection for 4 products",
  tax_code: "txcd_10103100",
  "default_price_data[unit_amount]": "1000",
  "default_price_data[currency]": "usd",
  "default_price_data[recurring][interval]": "month",
});

const response = await fetch("https://api.stripe.com/v1/products", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
    "Stripe-Version": apiVersion,
    "Idempotency-Key": "vintex-basic-subscription-v1",
  },
  body: form,
});

const result = await response.json();
if (!response.ok) {
  console.error(result?.error?.message ?? "Stripe could not create the product.");
  process.exit(1);
}

console.log(JSON.stringify({
  productId: result.id,
  priceId: typeof result.default_price === "string" ? result.default_price : result.default_price?.id,
  amount: "$10.00 USD / month",
  taxCode: result.tax_code,
}, null, 2));
