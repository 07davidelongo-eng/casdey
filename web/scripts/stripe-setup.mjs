/**
 * Creates the casdey product and its four prices in Stripe, then prints the
 * environment lines to paste into web/.env.local.
 *
 *   node scripts/stripe-setup.mjs
 *
 * Safe to run more than once: every price carries a lookup key, and an existing
 * one is reused rather than duplicated. Prices in Stripe are immutable, so
 * changing an amount means creating a new price and updating the env var, which
 * is exactly what re-running with a changed AMOUNTS table does.
 *
 * Refuses to run against a live key. Creating live prices is a decision to make
 * in the dashboard, deliberately, not a side effect of running a script.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const repoRoot = path.resolve(webRoot, "..");

/** Minimal .env reader: no dependency, no export/quote gymnastics needed. */
function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    out[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = {
  ...readEnvFile(path.join(repoRoot, ".env")),
  ...readEnvFile(path.join(webRoot, ".env.local")),
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
      "Create live prices in the Stripe dashboard by hand.",
  );
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2026-07-29.dahlia" });

// Amounts in the smallest unit. Annual is billed once at 12x the monthly rate.
const AMOUNTS = [
  { lookupKey: "casdey_gbp_month", currency: "gbp", interval: "month", amount: 25_000, envVar: "STRIPE_PRICE_GBP_MONTH", label: "£250 / month" },
  { lookupKey: "casdey_gbp_year",  currency: "gbp", interval: "year",  amount: 270_000, envVar: "STRIPE_PRICE_GBP_YEAR",  label: "£2,700 / year (£225 a month)" },
  { lookupKey: "casdey_eur_month", currency: "eur", interval: "month", amount: 29_000, envVar: "STRIPE_PRICE_EUR_MONTH", label: "€290 / month" },
  { lookupKey: "casdey_eur_year",  currency: "eur", interval: "year",  amount: 314_400, envVar: "STRIPE_PRICE_EUR_YEAR",  label: "€3,144 / year (€262 a month)" },
];

const PRODUCT_ID = "casdey_reactivation";

async function ensureProduct() {
  try {
    const existing = await stripe.products.retrieve(PRODUCT_ID);
    console.log(`product   ${existing.id} (exists)`);
    return existing;
  } catch (error) {
    if (error?.code !== "resource_missing") throw error;
  }

  const product = await stripe.products.create({
    id: PRODUCT_ID,
    name: "casdey",
    description:
      "Dormant-patient reactivation for dental practices. Finds the patients who came once or twice and never rebooked, then re-engages them.",
  });
  console.log(`product   ${product.id} (created)`);
  return product;
}

async function ensurePrice(product, spec) {
  const found = await stripe.prices.list({
    lookup_keys: [spec.lookupKey],
    limit: 1,
  });

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

    // Amounts cannot be edited. Move the lookup key onto a new price so the
    // old one stops being found while existing subscriptions on it continue.
    console.log(`price     ${price.id}  ${spec.label} (amount changed, replacing)`);
  }

  const price = await stripe.prices.create({
    product: product.id,
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

const product = await ensureProduct();
const lines = [];

for (const spec of AMOUNTS) {
  const price = await ensurePrice(product, spec);
  lines.push(`${spec.envVar}=${price.id}`);
}

console.log("\nAdd these to web/.env.local:\n");
console.log(lines.join("\n"));
console.log(
  "\nStill needed for the full flow:\n" +
    "  STRIPE_SECRET_KEY=...   (test key, same one this script used)\n" +
    "  STRIPE_WEBHOOK_SECRET=whsec_...\n" +
    "\nGet the webhook secret by running:\n" +
    "  stripe listen --forward-to localhost:3000/api/stripe/webhook\n",
);
