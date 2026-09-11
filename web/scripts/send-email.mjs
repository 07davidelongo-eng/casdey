/**
 * Sends a plaintext email via Zoho Mail, standalone (no Next.js runtime).
 * Same OAuth refresh-token flow and account as src/lib/zoho-mail.ts — this
 * exists because an unattended Claude Routine (e.g. the weekly /check-up)
 * has no chat to reply a report into, so it has to land somewhere Davide
 * will actually see it.
 *
 *   node scripts/send-email.mjs <to> <subject> <path/to/body.txt>
 */

import fs from "node:fs";

let dotenvCache;
function env(name) {
  if (process.env[name]) return process.env[name];
  if (dotenvCache === undefined) {
    dotenvCache = fs.existsSync("./.env.local") ? fs.readFileSync("./.env.local", "utf8") : "";
  }
  const m = dotenvCache.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!m) throw new Error(`Zoho credentials missing: ${name} is not set`);
  return m[1].trim();
}

async function accessToken() {
  const accounts = env("ZOHO_ACCOUNTS_DOMAIN").replace(/\/+$/, "");
  const res = await fetch(`${accounts}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: env("ZOHO_REFRESH_TOKEN"),
      client_id: env("ZOHO_CLIENT_ID"),
      client_secret: env("ZOHO_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  }).then((r) => r.json());
  if (!res.access_token) throw new Error(`Zoho token request failed: ${JSON.stringify(res)}`);
  return res.access_token;
}

const [, , to, subject, bodyPath] = process.argv;
if (!to || !subject || !bodyPath) {
  console.error("Usage: node scripts/send-email.mjs <to> <subject> <path/to/body.txt>");
  process.exit(1);
}
const text = fs.readFileSync(bodyPath, "utf8");

const token = await accessToken();
const api = env("ZOHO_API_DOMAIN").replace(/\/+$/, "");
const accountId = env("ZOHO_ACCOUNT_ID");

const res = await fetch(`${api}/api/accounts/${accountId}/messages`, {
  method: "POST",
  headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    fromAddress: process.env.CASDEY_FROM_ADDRESS ?? "info@casdey.com",
    toAddress: to,
    subject,
    content: text,
    mailFormat: "plaintext",
  }),
});

if (!res.ok) {
  console.error(`Zoho send failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
console.log(`Sent to ${to}: "${subject}"`);
