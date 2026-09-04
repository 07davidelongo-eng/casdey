"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import {
  ResendKeyNotPermittedError,
  ResendNotConfiguredError,
  createSendingDomain,
  deleteSendingDomain,
  getSendingDomain,
  normalizeDomain,
  normalizeLocalPart,
  toStatus,
  verifySendingDomain,
} from "@/lib/email/domains";

export type SendingState = { error: string | null; message: string | null };

/**
 * Setting up, checking and removing a gym's own email domain.
 *
 * The status in our row is only ever written from what Resend actually says.
 * Nothing here optimistically marks a domain verified: the whole value of this
 * feature is that mail leaves from a domain that genuinely passes SPF and
 * DKIM, and a row claiming otherwise would send a gym's campaigns straight to
 * spam under their own name.
 */

function friendly(error: unknown): string {
  if (error instanceof ResendNotConfiguredError) {
    return "Email sending is not configured on this deployment yet.";
  }
  // Same shape of answer as "not configured", deliberately: from where the gym
  // is standing these are the same problem, and neither is fixed by retrying.
  if (error instanceof ResendKeyNotPermittedError) {
    return "Sending from your own domain is not switched on for this deployment yet. Get in touch and we will sort it.";
  }
  const detail = error instanceof Error ? error.message : "";
  if (/already exists|duplicate/i.test(detail)) {
    return "That domain is already registered for sending. If it was set up somewhere else, remove it there first.";
  }
  return "We could not reach the email provider. Try again shortly.";
}

export async function connectDomainAction(
  _previous: SendingState,
  formData: FormData,
): Promise<SendingState> {
  const { gym, session } = await requireOwner();

  const domain = normalizeDomain(String(formData.get("domain") ?? ""));
  if (!domain) {
    return {
      error:
        "Enter a domain on its own, like ironworksgym.ie. Not a full web address and not an email address.",
      message: null,
    };
  }

  const local = normalizeLocalPart(String(formData.get("local") ?? "hello"));
  if (!local) {
    return {
      error:
        "The part before the @ can use letters, numbers, dots, dashes and underscores only.",
      message: null,
    };
  }

  // Replacing an existing setup: drop the old one at Resend first so we do not
  // leave orphaned domains behind on the account.
  if (gym.sending_domain_id) {
    try {
      await deleteSendingDomain(gym.sending_domain_id);
    } catch {
      // Already gone, or Resend is unhappy. Either way the new one is what
      // matters, and a stale record there is harmless.
    }
  }

  let created;
  try {
    created = await createSendingDomain(domain);
  } catch (error) {
    console.error("[sending] create domain failed", error);
    return { error: friendly(error), message: null };
  }

  const { error } = await supabaseAdmin()
    .from("gyms")
    .update({
      sending_domain: domain,
      sending_domain_id: created.id,
      sending_domain_status: toStatus(created.status),
      sending_domain_records: created.records,
      sending_from_local: local,
    })
    .eq("id", gym.id);

  if (error) {
    console.error("[sending] save failed", error.message);
    return { error: "We could not save that. Try again.", message: null };
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "sending.domain_connected",
    meta: { domain },
  });

  revalidatePath("/app/settings/sending");
  return {
    error: null,
    message:
      "Domain added. Add the DNS records below at whoever hosts your domain, then check again.",
  };
}

export async function checkDomainAction(): Promise<SendingState> {
  const { gym } = await requireOwner();

  if (!gym.sending_domain_id) {
    return { error: "There is no domain to check yet.", message: null };
  }

  try {
    // Ask Resend to look at DNS now, then read back what it concluded.
    await verifySendingDomain(gym.sending_domain_id);
    const domain = await getSendingDomain(gym.sending_domain_id);
    const status = toStatus(domain.status);

    await supabaseAdmin()
      .from("gyms")
      .update({
        sending_domain_status: status,
        sending_domain_records: domain.records,
      })
      .eq("id", gym.id);

    revalidatePath("/app/settings/sending");

    if (status === "verified") {
      return {
        error: null,
        message: `Verified. Your campaigns now send from ${gym.sending_from_local}@${gym.sending_domain}.`,
      };
    }
    if (status === "failed") {
      return {
        error:
          "The provider rejected this domain. Check the records match exactly, then try again.",
        message: null,
      };
    }
    return {
      error: null,
      message:
        "Not verified yet. DNS changes can take a few minutes to a few hours to spread, so check again shortly.",
    };
  } catch (error) {
    console.error("[sending] verify failed", error);
    return { error: friendly(error), message: null };
  }
}

export async function disconnectDomainAction(): Promise<SendingState> {
  const { gym, session } = await requireOwner();

  if (gym.sending_domain_id) {
    try {
      await deleteSendingDomain(gym.sending_domain_id);
    } catch (error) {
      console.error("[sending] delete failed", error);
    }
  }

  const { error } = await supabaseAdmin()
    .from("gyms")
    .update({
      sending_domain: null,
      sending_domain_id: null,
      sending_domain_status: "none",
      sending_domain_records: null,
    })
    .eq("id", gym.id);

  if (error) {
    return { error: "We could not disconnect that. Try again.", message: null };
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "sending.domain_disconnected",
    meta: { domain: gym.sending_domain },
  });

  revalidatePath("/app/settings/sending");
  return {
    error: null,
    message:
      "Disconnected. Campaigns go back to sending under your gym name on casdey's domain.",
  };
}
