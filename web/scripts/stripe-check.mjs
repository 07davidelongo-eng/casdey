/**
 * Verifies that this environment's Stripe configuration is actually correct,
 * against the live Stripe account, before anyone tries to pay.
 *
 *   npm run check:stripe
 *
 * Why this exists. The nine STRIPE_PRICE_* / STRIPE_COUPON_PERCENT values are
 * entered by hand for live mode (plan item F2: prices in Stripe are a
 * deliberate dashboard decision, not a script side effect). Nothing in the app
 * validates them at boot, and the way they fail is expensive rather than loud:
 *
 *   A missing or mistyped Standard price id means planTierForPriceId() finds no
 *   match, the webhook writes no plan_tier, and effectivePlan() reads a null
 *   tier on an active subscription as PRO. A gym paying €99 silently receives
 *   the WhatsApp channel and the refundable profit-or-nothing guarantee.
 *
 * The checkout route now also stamps the tier into the subscription metadata,
 * so that specific hole is plugged, but the fallback masks a misconfiguration
 * rather than reporting it. This script reports it.
 *
 * It only reads: no products, prices, coupons or subscriptions are created or
 * modified, so it is safe to point at the live account.
 *
 * Exit code is 0 when everything checks out, 1 when anything is wrong, so it
 * can gate a deploy.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

import { AMOUNTS, COUPON, readEnvFile } from "./price-spec.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const repoRoot = path.resolve(webRoot, "..");

const env = {
  ...readEnvFile(path.join(repoRoot, ".env"), fs),
  ...readEnvFile(path.join(webRoot, ".env.local"), fs),
  ...process.env,
};

/* ── reporting ─────────────────────────────────────────────────────────── */

const problems = [];
const warnings = [];

const ok = (msg) => console.log(`  ok    ${msg}`);
const bad = (msg, detail) => {
  problems.push(detail ? `${msg}\n        ${detail}` : msg);
  console.log(`  FAIL  ${msg}`);
  if (detail) console.log(`        ${detail}`);
};
const warn = (msg, detail) => {
  warnings.push(detail ? `${msg} — ${detail}` : msg);
  console.log(`  warn  ${msg}`);
  if (detail) console.log(`        ${detail}`);
};

/** Formats a smallest-unit amount the way a person reads it. */
function money(amount, currency) {
  const symbol = currency === "gbp" ? "£" : currency === "eur" ? "€" : "";
  return `${symbol}${(amount / 100).toLocaleString("en-GB")}`;
}

/* ── the key, and which mode we are checking ───────────────────────────── */

const key = env.STRIPE_SECRET_KEY;
if (!key) {
  console.error(
    "STRIPE_SECRET_KEY is not set. Add it to web/.env.local or the repo-root .env.\n" +
      "To check production, run with the live key:\n" +
      "  STRIPE_SECRET_KEY=sk_live_... npm run check:stripe",
  );
  process.exit(1);
}

const isLive = key.startsWith("sk_live_") || key.startsWith("rk_live_");
const mode = isLive ? "LIVE" : "test";

console.log(`\ncasdey Stripe config check — ${mode} mode\n`);

const stripe = new Stripe(key, { apiVersion: "2026-07-29.dahlia" });

/* ── 1. the account itself ─────────────────────────────────────────────── */

console.log("account");
try {
  const account = await stripe.accounts.retrieve();
  const label = account.settings?.dashboard?.display_name || account.id;
  if (account.charges_enabled) {
    ok(`${label} can accept charges`);
  } else {
    bad(
      `${label} cannot accept charges`,
      "Stripe account activation is incomplete; checkout will fail.",
    );
  }
} catch (error) {
  bad("could not reach Stripe with this key", error.message);
  console.log("\nNothing else can be checked without a working key.\n");
  process.exit(1);
}

/* ── 2. the eight prices ───────────────────────────────────────────────── */

console.log("\nprices");

/** env var -> price id, for the duplicate check below. */
const seen = new Map();

for (const spec of AMOUNTS) {
  const id = env[spec.envVar];

  if (!id) {
    bad(
      `${spec.envVar} is not set`,
      `Expected the ${spec.label} price id. A gym on this plan would resolve to no tier, ` +
        `and an unmatched tier on an active subscription is read as Pro.`,
    );
    continue;
  }

  if (!id.startsWith("price_")) {
    bad(
      `${spec.envVar} is not a price id`,
      `Got "${id}". Stripe price ids start with "price_" — a "prod_" id is the product, not the price.`,
    );
    continue;
  }

  if (seen.has(id)) {
    bad(
      `${spec.envVar} points at the same price as ${seen.get(id)}`,
      `Two plans sharing one price id means planTierForPriceId() returns whichever ` +
        `is listed first, so one of these tiers resolves wrongly.`,
    );
    continue;
  }
  seen.set(id, spec.envVar);

  let price;
  try {
    price = await stripe.prices.retrieve(id, { expand: ["product"] });
  } catch (error) {
    if (error?.code === "resource_missing") {
      bad(
        `${spec.envVar} does not exist in ${mode} mode`,
        `"${id}" was not found. Test-mode and live-mode ids are different; this is ` +
          `usually a ${isLive ? "test" : "live"}-mode id in the ${mode}-mode config.`,
      );
    } else {
      bad(`${spec.envVar} could not be read`, error.message);
    }
    continue;
  }

  const faults = [];
  if (price.unit_amount !== spec.amount) {
    faults.push(
      `charges ${money(price.unit_amount, price.currency)}, expected ${money(spec.amount, spec.currency)}`,
    );
  }
  if (price.currency !== spec.currency) {
    faults.push(`currency is ${price.currency}, expected ${spec.currency}`);
  }
  if (price.recurring?.interval !== spec.interval) {
    faults.push(
      `bills ${price.recurring?.interval ?? "once (not recurring)"}, expected ${spec.interval}ly`,
    );
  }
  if (!price.active) {
    faults.push("is archived in Stripe, so checkout with it fails");
  }

  const productId =
    typeof price.product === "string" ? price.product : price.product?.id;
  const productName =
    typeof price.product === "string" ? null : price.product?.name;
  if (productId !== spec.productId) {
    // Live products are created by hand, so the id often differs legitimately.
    // The tier still comes from the env var, so this is a warning, not a fault.
    warn(
      `${spec.envVar} belongs to product ${productName ?? productId}`,
      `expected "${spec.productId}". Fine if the live product was created by hand ` +
        `under a different id, as long as it is the ${spec.tier} product.`,
    );
  }

  if (faults.length > 0) {
    bad(`${spec.envVar} (${spec.label})`, faults.join("; "));
  } else {
    ok(`${spec.envVar.padEnd(32)} ${spec.label.padEnd(24)} ${id}`);
  }
}

/* ── 3. the early-adopter coupon ───────────────────────────────────────── */

console.log("\ncoupon");

const couponId = env[COUPON.envVar];
const legacy = env.STRIPE_COUPON_GBP || env.STRIPE_COUPON_EUR;

if (!couponId) {
  if (legacy) {
    bad(
      `${COUPON.envVar} is not set, but the retired per-currency coupons are`,
      `couponIdFor() falls back to the old fixed-amount coupons (£50/€59), which are ` +
        `wrong for three-tier pricing: on Standard they discount far more than 20%.`,
    );
  } else if (env.CASDEY_EARLY_ADOPTER_DISCOUNT === "false") {
    ok("no coupon set, and CASDEY_EARLY_ADOPTER_DISCOUNT is off — consistent");
  } else {
    bad(
      `${COUPON.envVar} is not set`,
      `Early adopters are promised a lifetime 20% off. With no coupon they would be ` +
        `charged full price. Set the coupon, or set CASDEY_EARLY_ADOPTER_DISCOUNT=false.`,
    );
  }
} else {
  try {
    const coupon = await stripe.coupons.retrieve(couponId);
    const faults = [];
    if (coupon.percent_off !== COUPON.percent_off) {
      faults.push(
        coupon.percent_off
          ? `is ${coupon.percent_off}% off, expected ${COUPON.percent_off}%`
          : `is a fixed-amount coupon (${money(coupon.amount_off, coupon.currency)} off), ` +
            `expected ${COUPON.percent_off}% — a fixed amount is not currency-agnostic`,
      );
    }
    if (coupon.duration !== COUPON.duration) {
      faults.push(
        `duration is "${coupon.duration}", expected "${COUPON.duration}" — the discount ` +
          `is promised for life, so anything else expires it`,
      );
    }
    if (!coupon.valid) {
      faults.push("is no longer valid in Stripe (redeem-by date passed, or deleted)");
    }
    if (faults.length > 0) {
      bad(`${COUPON.envVar} (${couponId})`, faults.join("; "));
    } else {
      ok(`${COUPON.envVar.padEnd(32)} ${`${coupon.percent_off}% off, forever`.padEnd(24)} ${couponId}`);
    }
  } catch (error) {
    if (error?.code === "resource_missing") {
      bad(
        `${COUPON.envVar} does not exist in ${mode} mode`,
        `"${couponId}" was not found.`,
      );
    } else {
      bad(`${COUPON.envVar} could not be read`, error.message);
    }
  }

  if (legacy) {
    warn(
      "the retired per-currency coupons are still set",
      "STRIPE_COUPON_GBP / STRIPE_COUPON_EUR are only a fallback now. Harmless, but " +
        "worth removing so nobody thinks they are live.",
    );
  }
}

/* ── 4. the webhook secret ─────────────────────────────────────────────── */

console.log("\nwebhook");

if (!env.STRIPE_WEBHOOK_SECRET) {
  bad(
    "STRIPE_WEBHOOK_SECRET is not set",
    "Without it every webhook is rejected: checkout completes and takes the money, " +
      "but the gym is never marked as paying and plan_tier is never written.",
  );
} else if (!env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")) {
  bad(
    "STRIPE_WEBHOOK_SECRET does not look like a signing secret",
    `Expected a value starting "whsec_".`,
  );
} else {
  ok("STRIPE_WEBHOOK_SECRET is set");
  console.log(
    `        (this script cannot tell whether it matches the ${mode} endpoint —\n` +
      `         confirm in Stripe → Developers → Webhooks that an endpoint points at\n` +
      `         https://casdey.com/api/stripe/webhook)`,
  );
}

/* ── verdict ───────────────────────────────────────────────────────────── */

console.log("");

if (problems.length === 0 && warnings.length === 0) {
  console.log(`All good. ${mode} mode is configured correctly.\n`);
  process.exit(0);
}

if (problems.length === 0) {
  console.log(
    `Configured correctly, with ${warnings.length} thing${warnings.length === 1 ? "" : "s"} worth a look.\n`,
  );
  process.exit(0);
}

console.log(
  `${problems.length} problem${problems.length === 1 ? "" : "s"} in ${mode} mode. ` +
    `Paid upgrades will not behave correctly until these are fixed.\n`,
);
if (!isLive) {
  console.log(
    "Note: this checked TEST mode. Production uses different ids — re-run with the\n" +
      "live key to check what customers actually hit:\n" +
      "  STRIPE_SECRET_KEY=sk_live_... npm run check:stripe\n",
  );
}
process.exit(1);
