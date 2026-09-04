import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ResendKeyNotPermittedError,
  ResendNotConfiguredError,
  createSendingDomain,
  getSendingDomain,
} from "./domains";

/**
 * Which key talks to Resend's Domains API, and what happens when it is the
 * wrong one.
 *
 * This is pinned because it already went wrong once and stayed wrong: Track G1
 * shipped reading RESEND_API_KEY, which is deliberately Sending-access-only, so
 * every /domains call answered 401 restricted_api_key. The gym was told to try
 * again shortly, which could never work.
 */

const REAL_FETCH = globalThis.fetch;

function answer(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/** The Authorization header the first fetch was called with. */
function bearer(mock: ReturnType<typeof answer>): string {
  const call = mock.mock.calls[0] as unknown as
    | [string, { headers?: Record<string, string> } | undefined]
    | undefined;
  return call?.[1]?.headers?.Authorization ?? "";
}

afterEach(() => {
  globalThis.fetch = REAL_FETCH;
  vi.unstubAllEnvs();
});

describe("which key is used", () => {
  it("prefers the admin key, so the send-path key stays unable to touch domains", async () => {
    vi.stubEnv("RESEND_ADMIN_API_KEY", "re_admin");
    vi.stubEnv("RESEND_API_KEY", "re_send_only");
    const fetchMock = answer(200, { id: "d1", name: "x.com", status: "pending" });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await createSendingDomain("x.com");

    expect(bearer(fetchMock)).toBe("Bearer re_admin");
  });

  it("falls back to the send key, for a deployment with one Full-access key", async () => {
    vi.stubEnv("RESEND_ADMIN_API_KEY", "");
    vi.stubEnv("RESEND_API_KEY", "re_only_one");
    const fetchMock = answer(200, { id: "d1", name: "x.com", status: "pending" });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await createSendingDomain("x.com");

    expect(bearer(fetchMock)).toBe("Bearer re_only_one");
  });

  it("reports missing configuration rather than calling Resend with nothing", async () => {
    vi.stubEnv("RESEND_ADMIN_API_KEY", "");
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchMock = answer(200, {});
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(createSendingDomain("x.com")).rejects.toBeInstanceOf(
      ResendNotConfiguredError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("a key that is not allowed to manage domains", () => {
  it("is its own error, not a generic failure, because retrying cannot fix it", async () => {
    vi.stubEnv("RESEND_ADMIN_API_KEY", "re_send_only");
    globalThis.fetch = answer(401, {
      statusCode: 401,
      message: "This API key is restricted to only send emails",
      name: "restricted_api_key",
    }) as unknown as typeof fetch;

    await expect(getSendingDomain("d1")).rejects.toBeInstanceOf(
      ResendKeyNotPermittedError,
    );
  });

  it("treats 403 the same way", async () => {
    vi.stubEnv("RESEND_ADMIN_API_KEY", "re_send_only");
    globalThis.fetch = answer(403, { message: "forbidden" }) as unknown as typeof fetch;

    await expect(getSendingDomain("d1")).rejects.toBeInstanceOf(
      ResendKeyNotPermittedError,
    );
  });

  it("leaves other failures as ordinary errors", async () => {
    vi.stubEnv("RESEND_ADMIN_API_KEY", "re_admin");
    globalThis.fetch = answer(500, { message: "boom" }) as unknown as typeof fetch;

    const error = await getSendingDomain("d1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ResendKeyNotPermittedError);
  });
});
