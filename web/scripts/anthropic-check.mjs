/**
 * Verifies that personalisation can actually run in this environment.
 *
 *   npm run check:anthropic
 *
 * Why this exists. Personalisation (D1 #8) is built, on by default, and has
 * been falling back to the plain template on every send since it shipped,
 * because the Anthropic account behind the key has no credit. Nothing surfaced
 * it: the fallback is deliberate and silent so a campaign still goes out, which
 * is the right behaviour and also the reason nobody noticed for two weeks.
 *
 * The lesson is the one check:resend exists for: a credential is not verified
 * by being set. A key can be present, well formed and completely unable to do
 * the job, and the only honest check is to call the API and read the reply.
 *
 * It sends one tiny message. It creates nothing, changes nothing, and costs a
 * fraction of a cent, so it is safe to point anywhere.
 *
 * To check a key that is not the one in .env.local, pass it in:
 *
 *   ANTHROPIC_API_KEY=sk-ant-... npm run check:anthropic
 *
 * Exit code is 0 when personalisation would work, 1 when it would not.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, "..", ".env.local");

function readKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  if (!fs.existsSync(envPath)) return null;
  const match = /^ANTHROPIC_API_KEY=(.*)$/m.exec(
    fs.readFileSync(envPath, "utf8"),
  );
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : null;
}

async function main() {
  const key = readKey();

  if (!key) {
    console.error("FAIL   no ANTHROPIC_API_KEY, here or in web/.env.local.");
    console.error(
      "       Personalisation is off entirely: every member gets the gym's",
    );
    console.error("       template exactly as written.");
    return 1;
  }

  console.log(
    `key    present, ${key.length} characters, ending ${key.slice(-6)}`,
  );

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      // The model personalisation itself uses. Checking a different one would
      // prove the account works, not that this feature does.
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with the single word: ready" }],
    }),
  });

  const body = await response.text();

  if (response.ok) {
    console.log("call   200, the model answered");
    console.log("");
    console.log(
      "PASS   personalisation will write each member their own message.",
    );
    return 0;
  }

  console.error(`call   ${response.status}`);
  console.error(body.slice(0, 300));
  console.error("");

  if (body.includes("credit balance")) {
    console.error("FAIL   the key works, the account has no credit.");
    console.error(
      "       Anthropic is prepaid: add credit at console.anthropic.com under",
    );
    console.error(
      "       Plans & Billing. Until then every campaign sends the gym's plain",
    );
    console.error(
      "       template and the WhatsApp assistant answers nobody, both silently.",
    );
  } else if (response.status === 401) {
    console.error("FAIL   the key was rejected. Wrong key, or it was revoked.");
  } else {
    console.error("FAIL   personalisation would fall back to the template.");
  }

  return 1;
}

// exitCode rather than process.exit(): exiting while fetch still holds a socket
// open trips a libuv assertion on Windows, which looks like a crash in a script
// whose entire job is to report clearly.
process.exitCode = await main();
