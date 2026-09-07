/**
 * Writes a local Markdown file into an existing Google Doc, in place.
 *
 *   npm run doc:push -- <fileId> <path/to/file.md>
 *   npm run doc:push            # defaults to casdey HQ
 *
 * Why this exists. The Google Drive *connector* can create, read and trash
 * files but cannot write their content: its update_file handles title and
 * parent only. So a document meant to be revised constantly could only ever be
 * replaced, which changes the file id and breaks every link and pointer to it.
 *
 * The outreach routine already solved the same problem for Sheets: a service
 * account (casdey-routine@casdey-gws-cli.iam.gserviceaccount.com) mints a
 * short-lived token with the JWT Bearer grant and calls the Google API
 * directly. This does that for Docs.
 *
 * It uses Drive's media update rather than the Docs API's batchUpdate.
 * batchUpdate builds a document out of structural elements, which means
 * assembling every heading, row and cell by index — laborious, and easy to
 * corrupt. Drive's media update takes Markdown, converts it the same way an
 * import does, and replaces the body while keeping the SAME FILE ID. Headings
 * and tables survive; the link never changes.
 *
 * The Doc must be shared with the service account as an editor. That is a
 * one-time step per document, done from Drive's own share dialog.
 *
 * The Markdown in the repo is the source of truth. The Doc is a rendered copy
 * for reading on a phone, so edits made in the Doc are overwritten by the next
 * push. Change the .md, then push.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

/** casdey HQ, the business one-pager. See CLAUDE.md "Business overview". */
const DEFAULT_DOC = "1qJWaqeWSjsG_osRH8NmS2JxP2URtfccCsRaPWypTGOI";
const DEFAULT_MARKDOWN = path.join(repoRoot, "casdey-hq.md");

/**
 * The service-account key. Never committed: it is a private key, and
 * .gitignore has covered casdey-gws-cli-*.json since 2026-09-07.
 */
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

/** A one-hour access token, straight from the key. No consent screen. */
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
  return { token: response.access_token, actor: key.client_email };
}

const [, , docArg, mdArg] = process.argv;
const fileId = docArg || DEFAULT_DOC;
const markdownPath = mdArg ? path.resolve(mdArg) : DEFAULT_MARKDOWN;

if (!fs.existsSync(markdownPath)) {
  console.error(`No such file: ${markdownPath}`);
  process.exit(1);
}

const markdown = fs.readFileSync(markdownPath, "utf8");

const { token, actor } = await accessToken(
  "https://www.googleapis.com/auth/drive",
);

const result = await fetch(
  `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
  {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/markdown" },
    body: markdown,
  },
).then((r) => r.json());

if (result.error) {
  const { status, message } = result.error;
  console.error(`\nFailed: ${status} — ${message}`);
  if (status === "PERMISSION_DENIED" || status === "NOT_FOUND") {
    console.error(
      `\nShare the document with ${actor} as an Editor. Drive will warn that it ` +
        `is not a person; that is expected, it is casdey's service account.`,
    );
  }
  process.exit(1);
}

console.log(
  `\nPushed ${path.relative(repoRoot, markdownPath)} → ${result.name ?? fileId}` +
    `\nhttps://docs.google.com/document/d/${fileId}/edit` +
    `\nSame document, same link. ${markdown.length.toLocaleString()} characters written.\n`,
);
