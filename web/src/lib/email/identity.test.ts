import { describe, expect, it } from "vitest";

import { sendingIdentity } from "./identity";
import { normalizeDomain, normalizeLocalPart, toStatus } from "./domains";
import type { Gym } from "../types";

/**
 * The rule that decides what a lapsed member sees in their inbox.
 *
 * The failure that matters here is sending from a domain that is *not* proven:
 * unauthenticated mail on the gym's own domain is punished harder by spam
 * filters than mail from casdey's, and the reputation it burns belongs to the
 * customer. So "pending" must behave exactly like "not set up".
 */

function gym(overrides: Partial<Gym> = {}): Gym {
  return {
    id: "g1",
    created_at: "2026-09-04T00:00:00Z",
    name: "Iron Works Gym",
    country: "IE",
    timezone: "Europe/Dublin",
    contact_email: "owner@ironworks.ie",
    sender_name: null,
    reply_to_email: "hello@ironworks.ie",
    lapsed_after_months: 12,
    max_visits: 2,
    at_risk_after_days: 45,
    daily_send_cap: 50,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: "none",
    plan_tier: null,
    plan_currency: null,
    plan_interval: null,
    trial_ends_at: null,
    current_period_end: null,
    premium_started_at: null,
    early_adopter: true,
    booking_value_minor: null,
    processing_agreed_at: null,
    onboarded_at: null,
    booking_enabled: false,
    booking_slot_minutes: 30,
    booking_buffer_minutes: 0,
    booking_min_notice_hours: 24,
    booking_horizon_days: 21,
    booking_hours: {},
    whatsapp_enabled: false,
    whatsapp_template_name: null,
    whatsapp_from: null,
    sending_domain: null,
    sending_domain_id: null,
    sending_domain_status: "none",
    sending_domain_records: null,
    sending_from_local: "hello",
    offer_id: null,
    offer_text: null,
    offer_expires_at: null,
    offer_inputs: null,
    offer_chosen_at: null,
    ...overrides,
  };
}

describe("sendingIdentity", () => {
  it("falls back to casdey's domain when the gym has none", () => {
    const identity = sendingIdentity(gym());
    expect(identity.address).toBeNull();
    expect(identity.ownDomain).toBe(false);
    // The gym's name is on the message either way. That was already true.
    expect(identity.name).toBe("Iron Works Gym");
  });

  it("uses the gym's own address once the domain is verified", () => {
    const identity = sendingIdentity(
      gym({
        sending_domain: "ironworks.ie",
        sending_domain_status: "verified",
        sending_from_local: "hello",
      }),
    );
    expect(identity.address).toBe("hello@ironworks.ie");
    expect(identity.ownDomain).toBe(true);
  });

  it("refuses to send from a domain that is only pending", () => {
    const identity = sendingIdentity(
      gym({ sending_domain: "ironworks.ie", sending_domain_status: "pending" }),
    );
    expect(identity.address).toBeNull();
    expect(identity.ownDomain).toBe(false);
  });

  it("refuses a domain the provider rejected", () => {
    const identity = sendingIdentity(
      gym({ sending_domain: "ironworks.ie", sending_domain_status: "failed" }),
    );
    expect(identity.address).toBeNull();
  });

  it("prefers the configured sender name over the gym name", () => {
    expect(sendingIdentity(gym({ sender_name: "Iron Works" })).name).toBe(
      "Iron Works",
    );
  });

  it("survives an empty local part rather than sending from @domain", () => {
    const identity = sendingIdentity(
      gym({
        sending_domain: "ironworks.ie",
        sending_domain_status: "verified",
        sending_from_local: "",
      }),
    );
    expect(identity.address).toBe("hello@ironworks.ie");
  });
});

describe("normalizeDomain", () => {
  it("accepts a bare domain", () => {
    expect(normalizeDomain("ironworks.ie")).toBe("ironworks.ie");
  });

  it("strips what people actually paste", () => {
    expect(normalizeDomain(" HTTPS://WWW.IronWorks.ie/pricing ")).toBe(
      "ironworks.ie",
    );
    expect(normalizeDomain("ironworks.ie.")).toBe("ironworks.ie");
  });

  it("rejects an email address, which is the likeliest mistake", () => {
    expect(normalizeDomain("hello@ironworks.ie")).toBeNull();
  });

  it("rejects things that are not domains", () => {
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("localhost")).toBeNull();
    expect(normalizeDomain("iron works.ie")).toBeNull();
    expect(normalizeDomain("ironworks.")).toBeNull();
    expect(normalizeDomain("-ironworks.ie")).toBeNull();
  });

  it("keeps subdomains, which a gym may legitimately want", () => {
    expect(normalizeDomain("mail.ironworks.ie")).toBe("mail.ironworks.ie");
  });
});

describe("normalizeLocalPart", () => {
  it("accepts ordinary mailbox names", () => {
    expect(normalizeLocalPart("Hello")).toBe("hello");
    expect(normalizeLocalPart("front-desk")).toBe("front-desk");
    expect(normalizeLocalPart("no.reply")).toBe("no.reply");
  });

  it("rejects anything that could break out of the header", () => {
    expect(normalizeLocalPart("")).toBeNull();
    expect(normalizeLocalPart("hello@there")).toBeNull();
    expect(normalizeLocalPart("hello there")).toBeNull();
    expect(normalizeLocalPart("-hello")).toBeNull();
    expect(normalizeLocalPart("hello-")).toBeNull();
  });
});

describe("toStatus", () => {
  it("only treats an explicit verified as verified", () => {
    expect(toStatus("verified")).toBe("verified");
    expect(toStatus("VERIFIED")).toBe("verified");
  });

  it("treats anything unrecognised as still pending, never verified", () => {
    expect(toStatus("not_started")).toBe("pending");
    expect(toStatus("pending")).toBe("pending");
    expect(toStatus("temporary_failure")).toBe("pending");
    expect(toStatus("some_new_status_resend_invented")).toBe("pending");
  });

  it("passes a hard failure through", () => {
    expect(toStatus("failed")).toBe("failed");
  });
});
