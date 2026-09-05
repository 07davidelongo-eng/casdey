/**
 * Checks the Stripe configuration that PRODUCTION actually runs on, against
 * the live Stripe account.
 *
 *   npm run check:stripe:prod
 *
 * Why this is separate from `check:stripe`. That one checks whatever is in
 * this machine's `.env.local`, which since 2026-09-05 is the *test*-mode
 * catalogue, so it can never answer the only question that matters before
 * anyone pays: are the values in Vercel right? Those are entered by hand, and
 * a wrong one fails expensively rather than loudly (a Standard price id that
 * does not resolve leaves plan_tier null, and a null tier on an active
 * subscription reads as Pro, so a €99 gym silently gets the WhatsApp channel
 * and the refundable guarantee).
 *
 * It pulls the production environment from Vercel, then runs the same checker
 * against it using the live key from STRIPE_SECRET_KEY_LIVE. Read-only on both
 * sides: nothing is created or modified in Stripe or in Vercel.
 *
 * What it CANNOT check, and nothing automated can: whether
 * STRIPE_WEBHOOK_SECRET matches the live endpoint's signing secret. Stripe
 * returns that secret once, at creation, and never again. It has to be
 * compared by eye in the dashboard, and it is worth doing, because a wrong one
 * means checkout takes the money and the plan is never activated.
 */

import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readEnvFile } from "./price-spec.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");

const local = readEnvFile(path.join(webRoot, ".env.local"), fs);
const liveKey = local.STRIPE_SECRET_KEY_LIVE ?? process.env.STRIPE_SECRET_KEY_LIVE;

if (!liveKey) {
  console.error(
    "\nSTRIPE_SECRET_KEY_LIVE is not set in web/.env.local.\n" +
      "It is kept under that name so an ordinary `npm run check:stripe` and a\n" +
      "local checkout cannot accidentally touch the live account.\n",
  );
  process.exit(1);
}
if (!liveKey.startsWith("sk_live_")) {
  console.error("\nSTRIPE_SECRET_KEY_LIVE is not a live key.\n");
  process.exit(1);
}

const target = path.join(os.tmpdir(), `casdey-prod-env-${process.pid}`);

console.log("\nPulling the production environment from Vercel…");
try {
  // A single quoted command string, not an argument array: npx resolves to
  // npx.cmd on Windows, which Node refuses to spawn without a shell, and
  // passing an array alongside shell:true only concatenates it anyway. The
  // one interpolated value is a temp path this script chose itself.
  execSync(
    `npx vercel env pull "${target}" --environment=production --yes`,
    { cwd: webRoot, stdio: "pipe" },
  );
} catch (error) {
  console.error(
    "\nCould not pull the production environment.\n" +
      "Run `npx vercel login` and make sure this directory is linked to the project.\n" +
      String(error.stderr ?? error.message).slice(0, 400),
  );
  process.exit(1);
}

let prod;
try {
  prod = readEnvFile(target, fs);
} finally {
  // The pulled file holds production configuration; do not leave it lying about.
  try {
    fs.unlinkSync(target);
  } catch {
    /* already gone */
  }
}

// Only the values this check is about. Everything else in the production
// environment stays out of the child process.
const passed = {};
for (const [name, value] of Object.entries(prod)) {
  if (name.startsWith("STRIPE_PRICE_") || name === "STRIPE_COUPON_PERCENT") {
    passed[name] = value;
  }
}

const count = Object.keys(passed).length;
console.log(`Pulled ${count} Stripe price/coupon values from production.\n`);

execFileSync("node", [path.join(here, "stripe-check.mjs")], {
  cwd: webRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    ...passed,
    STRIPE_SECRET_KEY: liveKey,
    // Vercel marks the real one sensitive, so it cannot be read back here.
    // Passed only so the checker does not report it as missing; its value is
    // the one thing that has to be compared by hand in the dashboard.
    STRIPE_WEBHOOK_SECRET: "whsec_unreadable_compare_in_dashboard",
    CASDEY_STRIPE_CHECK_SOURCE: "vercel-production",
  },
});

console.log(
  "Note: STRIPE_WEBHOOK_SECRET above was not really checked. Vercel keeps it\n" +
    "secret, and Stripe will not show it again after creation. Compare it by\n" +
    "eye: Stripe Dashboard, Developers, Webhooks, the casdey.com endpoint,\n" +
    "reveal the signing secret, and check it against Vercel.\n",
);
