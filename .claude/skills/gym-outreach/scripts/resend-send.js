#!/usr/bin/env node
// Sends one email via the Resend API and prints back { id } — the Resend
// email_id needed to correlate later webhook/dashboard tracking (opens,
// clicks) back to the row logged in the "Send Log" tab.
//
// Sends from davide@casdey.com on the casdey.com Resend domain (added
// 2026-08-22, separate from mail.casdey.com), with reply-to set to the same
// address — Resend is just the outbound path (SPF/DKIM now authorize it
// alongside Zoho to send as casdey.com), replies still land in the real
// Zoho inbox. Reply detection (see SKILL.md) is unaffected by this switch,
// it still reads that same Zoho inbox.
//
// Usage: node resend-send.js '<json>'
//   json: { to, subject, text, replyTo }
// Requires RESEND_API_KEY and CASDEY_OUTREACH_SENDING_ADDRESS in env.
// Prints { "id": "<resend-email-id>" } to stdout on success.

async function send({ to, subject, text, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const from = process.env.CASDEY_OUTREACH_SENDING_ADDRESS;
  if (!from) throw new Error("CASDEY_OUTREACH_SENDING_ADDRESS is not set");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `Davide @casdey <${from}>`,
      to: [to],
      subject,
      text,
      reply_to: replyTo || undefined,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return { id: body.id ?? null };
}

if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node resend-send.js \'{"to":"...","subject":"...","text":"...","replyTo":"..."}\'');
    process.exit(1);
  }
  const input = JSON.parse(arg);
  send(input)
    .then((result) => console.log(JSON.stringify(result)))
    .catch((err) => {
      console.error(String(err));
      process.exit(1);
    });
}

module.exports = { send };
