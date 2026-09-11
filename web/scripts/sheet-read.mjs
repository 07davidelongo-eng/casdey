/**
 * Reads values out of a Google Sheet using the same service account the
 * outreach routines already write with (casdey-routine@casdey-gws-cli.iam.gserviceaccount.com).
 * Read-only: uses the spreadsheets.readonly scope, never writes.
 *
 *   node scripts/sheet-read.mjs <sheetId> <A1 range, e.g. "Send Log!A1:Z">
 *
 * Prints the range as JSON: { range, values: string[][] }.
 *
 * Same JWT Bearer pattern as scripts/google-doc.mjs — see that file's header
 * for why a service account rather than the Drive connector.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

function keyPath() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
    return process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  }
  const found = fs
    .readdirSync(repoRoot)
    .find((f) => /^casdey-gws-cli-.*\.json$/.test(f));
  if (!found) {
    throw new Error(
      "No service-account key found. Put casdey-gws-cli-<id>.json at the repo " +
        "root, or set GOOGLE_SERVICE_ACCOUNT_FILE to its path.",
    );
  }
  return path.join(repoRoot, found);
}

const base64url = (input) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

async function accessToken(scope) {
  const key = JSON.parse(fs.readFileSync(keyPath(), "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const signingInput =
    `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.` +
    `${base64url(
      JSON.stringify({
        iss: key.client_email,
        scope,
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

  const response = await fetch(key.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  }).then((r) => r.json());

  if (!response.access_token) {
    throw new Error(`token request failed: ${JSON.stringify(response)}`);
  }
  return response.access_token;
}

const [, , sheetId, range] = process.argv;
if (!sheetId || !range) {
  console.error('Usage: node scripts/sheet-read.mjs <sheetId> "<Tab!A1:Z>"');
  process.exit(1);
}

const token = await accessToken(
  "https://www.googleapis.com/auth/spreadsheets.readonly",
);

const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
const result = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

if (result.error) {
  console.error(`Failed: ${result.error.status} — ${result.error.message}`);
  process.exit(1);
}

console.log(JSON.stringify(result));
