/**
 * Zoho Mail send path, reusing the credentials the cold-outreach system already
 * has. Authenticated as davide@casdey.com, sending with info@casdey.com as the
 * from address.
 *
 * EU data centre: ZOHO_API_DOMAIN is mail.zoho.eu, ZOHO_ACCOUNTS_DOMAIN is
 * accounts.zoho.eu.
 */

let cachedToken: { value: string; expiresAt: number } | null = null;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Zoho credentials missing: ${name} is not set`);
  return value;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const accounts = required("ZOHO_ACCOUNTS_DOMAIN").replace(/\/+$/, "");
  const res = await fetch(`${accounts}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: required("ZOHO_REFRESH_TOKEN"),
      client_id: required("ZOHO_CLIENT_ID"),
      client_secret: required("ZOHO_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });

  const body = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!res.ok || !body.access_token) {
    throw new Error(`Zoho token request failed: ${res.status}`);
  }

  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

/**
 * Note on reply-to: Zoho rejects the send outright ("You need to verify the
 * ReplyTo address") unless the address is one it has verified on the account,
 * so an arbitrary signup address can never be used there. Put it in the body
 * instead.
 */
export async function sendMail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const token = await getAccessToken();
  const api = required("ZOHO_API_DOMAIN").replace(/\/+$/, "");
  const accountId = required("ZOHO_ACCOUNT_ID");

  const res = await fetch(`${api}/api/accounts/${accountId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fromAddress: process.env.CASDEY_FROM_ADDRESS ?? "info@casdey.com",
      toAddress: to,
      subject,
      content: text,
      mailFormat: "plaintext",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Zoho send failed: ${res.status} ${detail.slice(0, 300)}`);
  }
}
