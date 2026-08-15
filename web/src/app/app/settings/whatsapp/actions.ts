"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";

export type WhatsAppSettingsState = { error: string | null; saved: boolean };

const Schema = z.object({
  enabled: z.boolean(),
  // The Twilio Content SID (e.g. "HXxxxxxxxx…") of the template Meta has
  // approved for this practice's first contact. Blank is allowed: a practice
  // can turn WhatsApp on before its template is approved, it just cannot
  // create a WhatsApp campaign until this is set (checked at campaign
  // creation, not here).
  templateName: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v)),
});

export async function saveWhatsAppSettingsAction(
  _previous: WhatsAppSettingsState,
  formData: FormData,
): Promise<WhatsAppSettingsState> {
  const { practice, session } = await requireOwner();

  const parsed = Schema.safeParse({
    enabled: formData.get("enabled") === "on",
    templateName: formData.get("templateName") ?? "",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form.",
      saved: false,
    };
  }

  const { error } = await supabaseAdmin()
    .from("practices")
    .update({
      whatsapp_enabled: parsed.data.enabled,
      whatsapp_template_name: parsed.data.templateName,
    })
    .eq("id", practice.id);

  if (error) {
    console.error("[whatsapp settings] update failed", error.message);
    return { error: "We could not save that. Try again.", saved: false };
  }

  await recordAudit({
    practiceId: practice.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "whatsapp.settings_updated",
    meta: { enabled: parsed.data.enabled },
  });

  revalidatePath("/app", "layout");
  return { error: null, saved: true };
}
