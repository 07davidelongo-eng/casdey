/**
 * Marketing snapshot for /check-up: pulls live numbers out of the
 * Casdey-Gym-Leads sheet (id in CLAUDE.md "Stage 1 progress") via the same
 * service-account JWT pattern as scripts/google-doc.mjs / sheet-read.mjs.
 * Read-only.
 *
 *   node scripts/check-up-marketing.mjs
 *
 * Prints one JSON object: { leads, sendLog, igOutreach, testLog }.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const SHEET_ID = "1WOAIA1gvK6S1kWe_Vf4-d4XmjhnDLQZLtyU_ezvOu3w"; // Casdey-Gym-Leads

/**
 * The service-account key. Three ways in, in order, so this runs the same
 * locally (a key file at the repo root, gitignored) and in a cloud routine
 * (which has no such file — its secret has to arrive as an env var):
 *   1. GOOGLE_SERVICE_ACCOUNT_JSON — the whole key file's contents, inline.
 *   2. GOOGLE_SERVICE_ACCOUNT_FILE — a path to it.
 *   3. casdey-gws-cli-*.json at the repo root (the local default).
 */
function serviceAccountKey() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }
  const file =
    process.env.GOOGLE_SERVICE_ACCOUNT_FILE ??
    (() => {
      const found = fs
        .readdirSync(repoRoot)
        .find((f) => /^casdey-gws-cli-.*\.json$/.test(f));
      return found ? path.join(repoRoot, found) : null;
    })();
  if (!file) {
    throw new Error(
      "No service-account key: set GOOGLE_SERVICE_ACCOUNT_JSON (the key file's " +
        "contents) or GOOGLE_SERVICE_ACCOUNT_FILE (a path to it), or put " +
        "casdey-gws-cli-<id>.json at the repo root.",
    );
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const base64url = (input) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

async function accessToken() {
  const key = serviceAccountKey();
  const now = Math.floor(Date.now() / 1000);
  const signingInput =
    `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.` +
    `${base64url(
      JSON.stringify({
        iss: key.client_email,
        scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
        aud: key.token_uri,
        iat: now,
        exp: now + 3600,
      }),
    )}`;
  const signature = crypto.sign(
    "RSA-SHA256",
    Buffer.from(signingInput),
    key.private_key,
  );
  const jwt = `${signingInput}.${base64url(signature)}`;
  const res = await fetch(key.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  }).then((r) => r.json());
  if (!res.access_token) throw new Error(`token failed: ${JSON.stringify(res)}`);
  return res.access_token;
}

async function values(token, range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  if (r.error) throw new Error(`${range}: ${r.error.status} — ${r.error.message}`);
  return r.values ?? [];
}

const token = await accessToken();
const now = Date.now();
const weekAgo = now - 7 * 86_400_000;
const isRecent = (dateStr) => {
  if (!dateStr) return false;
  const t = Date.parse(dateStr);
  return !Number.isNaN(t) && t >= weekAgo;
};

// --- Leads tab: # B..U, Status = col R (index 17), Reply? = col U (index 20) ---
const leadsRows = await values(token, "Leads!A2:U6000");
const statusCounts = {};
let repliedYes = 0;
let contacted = 0;
for (const row of leadsRows) {
  const status = (row[17] ?? "").trim() || "(blank)";
  statusCounts[status] = (statusCounts[status] ?? 0) + 1;
  if (status !== "Not contacted" && status !== "(blank)") contacted += 1;
  if ((row[20] ?? "").trim().toUpperCase() === "Y") repliedYes += 1;
}
const responded = (statusCounts["Replied"] ?? 0) + (statusCounts["Interested"] ?? 0) + (statusCounts["Committed"] ?? 0);

// --- Send Log: D=Date Sent, N=Variant (A/B on the first-touch row, FU1/FU2 on
// a follow-up's own row — each actual send is its own row), Q=Subject Variant
// (first-touch only). "Follow-up Sent (Y/N)" flags (H, P) are a per-lead
// summary, not per-send, so counting rows is the accurate way to size volume.
const sendRows = await values(token, "Send Log!A2:Q10000");
let totalSendRows = 0;
let sentThisWeek = 0;
const rowTypeCounts = { firstTouch: 0, fu1: 0, fu2: 0, other: 0 };
const rowTypeThisWeek = { firstTouch: 0, fu1: 0, fu2: 0, other: 0 };
const variantCounts = {}; // A / B, first-touch CTA framing
const subjectVariantCounts = {}; // S1 / S2, first-touch subject line
for (const row of sendRows) {
  const dateSent = row[3];
  if (!dateSent) continue;
  totalSendRows += 1;
  const recent = isRecent(dateSent);
  if (recent) sentThisWeek += 1;
  const variant = (row[13] ?? "").trim();
  const bucket = variant === "A" || variant === "B" ? "firstTouch" : variant === "FU1" ? "fu1" : variant === "FU2" ? "fu2" : "other";
  rowTypeCounts[bucket] += 1;
  if (recent) rowTypeThisWeek[bucket] += 1;
  if (bucket === "firstTouch") variantCounts[variant] = (variantCounts[variant] ?? 0) + 1;
  const subjectVariant = (row[16] ?? "").trim();
  if (subjectVariant) subjectVariantCounts[subjectVariant] = (subjectVariantCounts[subjectVariant] ?? 0) + 1;
}

// --- IG Outreach: I=Status, J=Date Sent, K=Reply? ---
const igRows = await values(token, "IG Outreach!A2:S3000");
let igSentTotal = 0;
let igSentThisWeek = 0;
let igReplies = 0;
for (const row of igRows) {
  const dateSent = row[9];
  if (dateSent) {
    igSentTotal += 1;
    if (isRecent(dateSent)) igSentThisWeek += 1;
  }
  if ((row[10] ?? "").trim().toUpperCase() === "Y") igReplies += 1;
}

// --- Test Log: as-is, the weekly review fills Sends/Replies/Winner by hand ---
const testRows = await values(token, "Test Log!A2:W50");
const testLog = testRows
  .filter((row) => row[0])
  .map((row) => ({
    id: row[0],
    weekStarted: row[1],
    asset: row[3],
    component: row[4],
    variantA: row[6],
    variantB: row[7],
    winner: row[18],
    weeksUnbeaten: row[20],
    status: row[21],
  }));

console.log(
  JSON.stringify(
    {
      leads: { total: leadsRows.length, contacted, statusCounts, responded, repliedYes, replyRatePct: contacted ? +((responded / contacted) * 100).toFixed(2) : null },
      sendLog: { totalSendRows, sentThisWeek, rowTypeCounts, rowTypeThisWeek, variantCounts, subjectVariantCounts },
      igOutreach: { igSentTotal, igSentThisWeek, igReplies },
      testLog,
    },
    null,
    1,
  ),
);
