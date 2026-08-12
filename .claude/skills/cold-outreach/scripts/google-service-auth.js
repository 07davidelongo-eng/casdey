#!/usr/bin/env node
// Mints a short-lived Google API access token from a service account key,
// via the JWT Bearer grant (no OAuth consent screen, no keyring, no 7-day expiry).
//
// Credential source, checked in this order:
//   1. GOOGLE_SERVICE_ACCOUNT_JSON  — the full service-account JSON as a string
//      (this is what the Claude Routine's cloud environment should set)
//   2. GOOGLE_SERVICE_ACCOUNT_FILE  — a local path to the JSON key file
//      (used for local testing, e.g. ~/.config/casdey/service-account.json)
//
// Usage: node google-service-auth.js ["scope1 scope2 ..."]
// Prints the access token (and nothing else) to stdout on success.

const fs = require("fs");
const crypto = require("crypto");

function loadKey() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
    return JSON.parse(fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_FILE, "utf8"));
  }
  throw new Error("Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE");
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getAccessToken(scope) {
  const key = loadKey();
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: key.client_email,
    scope,
    aud: key.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), key.private_key);
  const jwt = `${signingInput}.${base64url(signature)}`;

  const res = await fetch(key.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status} ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

if (require.main === module) {
  const scope = process.argv[2] || "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive";
  getAccessToken(scope)
    .then((token) => console.log(token))
    .catch((err) => {
      console.error(String(err));
      process.exit(1);
    });
}

module.exports = { getAccessToken };
