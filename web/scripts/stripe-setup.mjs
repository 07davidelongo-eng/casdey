/**
 * Creates the two casdey products (Standard, Pro) and their eight prices in
 * Stripe test mode, plus the lifetime early-adopter coupon, then prints the
 * environment lines to paste into web/.env.local.
 *
 *   node scripts/stripe-setup.mjs
 *
 * casdey's market is Europe, so prices lead in EUR; GBP keeps its own round
 * numbers for the UK. Annual is "two months free" — 10x the monthly rate.
 *
 * Safe to run more than once: every price carries a lookup key and an existing
 * matching one is reused. Prices in Stripe are immutable, so changing an amount
 * means creating a new price and moving the lookup key, which is exactly what
 * re-running with a changed AMOUNTS table does.
 *
 * Refuses to run against a live key. Creating live prices is a deliberate
 * dashboard decision, not a script side effect — mirror this spec by hand.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

import { AMOUNTS, COUPON, PRODUCTS, readEnvFile } from "./price-spec.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const repoRoot = path.resolve(webRoot, "..");

const env = {
  ...readEnvFile(path.join(repoRoot, ".env"), fs),
  ...readEnvFile(path.join(webRoot, ".env.local"), fs),
  ...process.env,
};

const key = env.STRIPE_SECRET_KEY;
if (!key) {
  console.error(
    "STRIPE_SECRET_KEY is not set. Add it to web/.env.local or the repo-root .env.",
  );
  process.exit(1);
}

if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
  console.error(
    "That is not a test-mode key. This script only creates test data.\n" +
      "Create live products/prices/coupon in the Stripe dashboard by hand,\n" +
      "matching the amounts below.",
  );
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2026-07-29.dahlia" });

async function ensureProduct(spec) {
  try {
    const existing = await stripe.products.retrieve(spec.id);
    console.log(`product   ${existing.id} (exists)`);
    return existing;
  } catch (error) {
    if (error?.code !== "resource_missing") throw error;
  }
  const product = await stripe.products.create({
    id: spec.id,
    name: spec.name,
    description: spec.description,
  });
  console.log(`product   ${product.id} (created)`);
  return product;
}

async function ensurePrice(spec) {
  const found = await stripe.prices.list({ lookup_keys: [spec.lookupKey], limit: 1 });

  if (found.data.length > 0) {
    const price = found.data[0];
    const matches =
      price.unit_amount === spec.amount &&
      price.currency === spec.currency &&
      price.recurring?.interval === spec.interval;
    if (matches) {
      console.log(`price     ${price.id}  ${spec.label} (exists)`);
      return price;
    }
    console.log(`price     ${price.id}  ${spec.label} (amount changed, replacing)`);
  }

  const price = await stripe.prices.create({
    product: spec.productId,
    currency: spec.currency,
    unit_amount: spec.amount,
    recurring: { interval: spec.interval },
    lookup_key: spec.lookupKey,
    transfer_lookup_key: found.data.length > 0,
    nickname: spec.label,
  });
  console.log(`price     ${price.id}  ${spec.label} (created)`);
  return price;
}

async function ensureCoupon(spec) {
  try {
    const existing = await stripe.coupons.retrieve(spec.id);
    console.log(`coupon    ${existing.id}  ${spec.label} (exists)`);
    return existing;
  } catch (error) {
    if (error?.code !== "resource_missing") throw error;
  }
  const coupon = await stripe.coupons.create({
    id: spec.id,
    percent_off: spec.percent_off,
    duration: spec.duration,
    name: spec.label,
  });
  console.log(`coupon    ${coupon.id}  ${spec.label} (created)`);
  return coupon;
}

for (const spec of PRODUCTS) await ensureProduct(spec);

const lines = [];
for (const spec of AMOUNTS) {
  const price = await ensurePrice(spec);
  lines.push(`${spec.envVar}=${price.id}`);
}
const coupon = await ensureCoupon(COUPON);
lines.push(`${COUPON.envVar}=${coupon.id}`);

console.log("\nAdd these to web/.env.local:\n");
console.log(lines.join("\n"));
console.log(
  "\nStill needed for the full flow:\n" +
    "  STRIPE_SECRET_KEY=...   (test key, same one this script used)\n" +
    "  STRIPE_WEBHOOK_SECRET=whsec_...\n" +
    "\nGet the webhook secret by running:\n" +
    "  stripe listen --forward-to localhost:3000/api/stripe/webhook\n",
);
