import "server-only";

import type { SendingDomainRecord } from "../types";

/**
 * Resend's Domains API, wrapped.
 *
 * This is what makes "your members hear from you, not from casdey" true for
 * email. A gym registers its own domain here, adds the DNS records Resend
 * returns, and from then on its campaigns go out from hello@theirgym.com.
 *
 * Worth being clear about what Resend is actually verifying: it proves that
 * whoever set this up controls the domain's DNS. It does NOT verify casdey,
 * and there is no business-entity requirement anywhere in this flow. That is
 * why the email half of per-gym sending could ship immediately while the
 * WhatsApp half waits on Meta.
 *
 * Every call here is best-effort in the sense that a failure must never take
 * down a send: the caller falls back to casdey's shared domain, which still
 * carries the gym's display name.
 */

const API = "https://api.resend.com";

export class ResendNotConfiguredError extends Error {
  constructor() {
    super("RESEND_API_KEY is not set, so sending domains cannot be managed.");
    this.name = "ResendNotConfiguredError";
  }
}

export type ResendDomain = {
  id: string;
  name: string;
  /** Resend's own vocabulary: not_started / pending / verified / failed /
   *  temporary_failure. Mapped to ours by `toStatus`. */
  status: string;
  records: SendingDomainRecord[];
};

function key(): string {
  const value = process.env.RESEND_API_KEY;
  if (!value) throw new ResendNotConfiguredError();
  return value;
}

async function call(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<unknown> {
  const response = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Resend ${init?.method ?? "GET"} ${path} failed: ${response.status} ${detail.slice(0, 300)}`,
    );
  }

  return response.json();
}

function shape(payload: unknown): ResendDomain {
  const d = payload as {
    id?: string;
    name?: string;
    status?: string;
    records?: SendingDomainRecord[];
  };
  return {
    id: d.id ?? "",
    name: d.name ?? "",
    status: d.status ?? "not_started",
    records: Array.isArray(d.records) ? d.records : [],
  };
}

/**
 * Register the gym's domain with Resend. The returned records are what the
 * gym has to add at their registrar; nothing sends from this domain until
 * they do and verification passes.
 *
 * `region` matches where casdey's own sending already lives (Ireland), so a
 * gym's mail does not take a different path through the world than the rest.
 */
export async function createSendingDomain(
  domain: string,
): Promise<ResendDomain> {
  return shape(
    await call("/domains", {
      method: "POST",
      body: { name: domain, region: "eu-west-1" },
    }),
  );
}

/** Ask Resend to re-check DNS now, rather than waiting for its own sweep. */
export async function verifySendingDomain(id: string): Promise<void> {
  await call(`/domains/${id}/verify`, { method: "POST" });
}

export async function getSendingDomain(id: string): Promise<ResendDomain> {
  return shape(await call(`/domains/${id}`));
}

/** Remove it from Resend entirely, so a gym can start over or disconnect. */
export async function deleteSendingDomain(id: string): Promise<void> {
  await call(`/domains/${id}`, { method: "DELETE" });
}

/**
 * Resend's status vocabulary is wider than ours and it keeps adding to it.
 * Anything that is not clearly verified or clearly dead is treated as still
 * pending, because the cost of being wrong in that direction is a gym waiting
 * a bit longer, while the cost the other way is sending from a domain that
 * was never actually proven.
 */
export function toStatus(
  resendStatus: string,
): "pending" | "verified" | "failed" {
  const value = resendStatus.toLowerCase();
  if (value === "verified") return "verified";
  if (value === "failed") return "failed";
  return "pending";
}

/**
 * What a gym may type into the setup form. Deliberately strict: a bare
 * registrable domain, no scheme, no path, no address. Anything looser and the
 * value ends up inside a From header, which is not a place to be relaxed.
 */
export function normalizeDomain(input: string): string | null {
  const trimmed = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")
    .replace(/\.$/, "");

  if (!trimmed || trimmed.includes("@") || trimmed.includes(" ")) return null;
  if (trimmed.length > 253) return null;
  // At least one dot, valid LDH labels, TLD of two or more letters.
  if (!/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/** The local part of the From address on the gym's own domain. */
export function normalizeLocalPart(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed || trimmed.length > 64) return null;
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(trimmed)) return null;
  return trimmed;
}
