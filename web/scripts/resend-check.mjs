/**
 * Verifies that this environment can actually do what Settings -> Sending
 * promises: send casdey's own mail, AND manage a gym's own sending domain.
 *
 *   npm run check:resend
 *
 * Why this exists. Per-gym sending (Track G1) shipped against a key that could
 * never have worked. RESEND_API_KEY was created Sending-access-only, which is
 * correct for the send path, but every call in src/lib/email/domains.ts hits
 * Resend's /domains API and comes back:
 *
 *   401 {"name":"restricted_api_key","message":"This API key is restricted to
 *   only send emails"}
 *
 * Nothing surfaced that. The gym saw "we could not reach the email provider",
 * which reads as a blip worth retrying, and the retry could never succeed.
 * A key's *scope* is invisible until you call something it cannot do, so the
 * only honest check is to call it.
 *
 * It only reads: no domain is created, verified or deleted, so it is safe to
 * point at production.
 *
 * Exit code is 0 when everything checks out, 1 when anything is wrong.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readEnvFile } from "./price-spec.mjs";

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

const API = "https://api.resend.com";

/** Calls Resend and reports what happened, without throwing. */
async function probe(key, path) {
  try {
    const response = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const body = await response.text().catch(() => "");
    let parsed = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      /* Resend answers JSON; a non-JSON body is itself the useful detail. */
    }
    return { status: response.status, ok: response.ok, body, parsed };
  } catch (error) {
    return { status: 0, ok: false, body: String(error), parsed: null };
  }
}

console.log("\ncasdey Resend config check\n");

/* ── 1. the send key ───────────────────────────────────────────────────── */

console.log("send key (RESEND_API_KEY)");

const sendKey = env.RESEND_API_KEY;
if (!sendKey) {
  bad(
    "RESEND_API_KEY is not set",
    "Campaign email falls back to Zoho, which cannot set a per-gym reply-to.",
  );
} else {
  // There is no read endpoint a Sending-access-only key is allowed to call, so
  // this cannot be probed by finding something that succeeds. It is probed by
  // how it FAILS instead, which Resend makes possible by answering differently:
  //
  //   unknown key      -> 400 validation_error       "API key is invalid"
  //   real, send-only  -> 401 restricted_api_key     (authenticated, then scoped out)
  //   real, full       -> some other status entirely
  //
  // Being told "you are not allowed to do that" is proof the key is real, which
  // is the only thing this section can honestly establish. Whether it can send
  // is settled by sending, not by a preflight.
  const probed = await probe(sendKey, "/emails");
  if (probed.status === 0) {
    bad("could not reach Resend", probed.body.slice(0, 200));
  } else if (probed.parsed?.name === "validation_error") {
    bad(
      "RESEND_API_KEY is not a key Resend recognises",
      probed.parsed?.message ?? probed.body.slice(0, 200),
    );
  } else if (probed.parsed?.name === "restricted_api_key") {
    ok(`real, and Sending-access-only as intended (${sendKey.slice(0, 6)}…)`);
  } else {
    ok(`accepted by Resend (${sendKey.slice(0, 6)}…)`);
  }
}

const address = env.CASDEY_SENDING_ADDRESS;
if (!address) {
  warn(
    "CASDEY_SENDING_ADDRESS is not set",
    "Sends fall back to the Zoho from-address.",
  );
} else {
  ok(`sends as ${address}`);
}

/* ── 2. the admin key, which is what per-gym sending needs ─────────────── */

console.log("\ndomain key (RESEND_ADMIN_API_KEY, falls back to RESEND_API_KEY)");

const adminKey = env.RESEND_ADMIN_API_KEY || sendKey;
const usingFallback = !env.RESEND_ADMIN_API_KEY && Boolean(sendKey);

if (!adminKey) {
  bad(
    "no key available to manage sending domains",
    "Settings -> Sending cannot register a gym's domain. Set RESEND_ADMIN_API_KEY.",
  );
} else {
  if (usingFallback) {
    warn(
      "RESEND_ADMIN_API_KEY is not set, falling back to RESEND_API_KEY",
      "Works only if that key has Full access. Two keys is the safer split: " +
        "the send-path key should not be able to delete gyms' sending domains.",
    );
  }

  const probed = await probe(adminKey, "/domains");

  if (probed.ok) {
    const domains = Array.isArray(probed.parsed?.data) ? probed.parsed.data : [];
    ok(`can manage domains (${domains.length} registered)`);
    for (const domain of domains) {
      const status = domain.status ?? "unknown";
      const line = `${domain.name} — ${status}`;
      if (status === "verified") {
        ok(`  ${line}`);
        continue;
      }
      warn(`  ${line}`, "Not verified, so nothing sends from it.");

      // Which record is holding it up. Without this, "pending" is a dead end:
      // it looks the same whether the DNS is missing, wrong, or simply has not
      // reached Resend's resolver yet, and that ambiguity is what made the
      // first attempt at a gym domain unreadable for a whole session.
      const detail = await probe(adminKey, `/domains/${domain.id}`);
      for (const record of detail.parsed?.records ?? []) {
        // Printed exactly as Resend gives it, which is what the gym pastes
        // into their registrar. Do not build an FQDN from it: Resend names
        // records relative to the registrable domain, not to the one being
        // verified, so mail.casdey.com reports "resend._domainkey.mail".
        console.log(
          `          ${String(record.record ?? "?").padEnd(5)} ${record.name} — ${record.status ?? "?"}`,
        );
      }
      console.log(
        "          Records right but still pending? Resend verifies through SES,",
      );
      console.log(
        "          which can take hours. Check the values in public DNS, then wait.",
      );
    }

    if (domains.length >= 3) {
      warn(
        `${domains.length} domains registered, and Resend Free allows 3`,
        "Adding another gym's sending domain will fail until one is removed, " +
          "or the account moves to Pro (see SAAS_V1_PLAN.md G1a).",
      );
    }
  } else if (probed.parsed?.name === "restricted_api_key") {
    bad(
      "this key cannot manage domains: it is Sending-access-only",
      "Per-gym sending (Track G1) is dead in the water until a Full-access key " +
        "is set as RESEND_ADMIN_API_KEY. Create one at resend.com/api-keys.",
    );
  } else if (probed.parsed?.name === "validation_error") {
    bad(
      "the domain key is not a key Resend recognises",
      probed.parsed?.message ?? probed.body.slice(0, 200),
    );
  } else if (probed.status === 401 || probed.status === 403) {
    bad(
      `this key was refused for domain management (${probed.status})`,
      probed.parsed?.message ?? probed.body.slice(0, 200),
    );
  } else if (probed.status === 0) {
    bad("could not reach Resend", probed.body.slice(0, 200));
  } else {
    bad(
      `unexpected answer from Resend (${probed.status})`,
      probed.body.slice(0, 200),
    );
  }
}

/* ── verdict ───────────────────────────────────────────────────────────── */

console.log("");

if (problems.length === 0 && warnings.length === 0) {
  console.log("All good. Resend is configured correctly.\n");
  process.exit(0);
}

if (problems.length === 0) {
  console.log(
    `Configured correctly, with ${warnings.length} thing${warnings.length === 1 ? "" : "s"} worth a look.\n`,
  );
  process.exit(0);
}

console.log(
  `${problems.length} problem${problems.length === 1 ? "" : "s"}. ` +
    "Sending will not behave correctly until these are fixed.\n",
);
process.exit(1);
