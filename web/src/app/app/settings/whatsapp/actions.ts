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
  // approved for this gym's first contact. Blank is allowed: a gym can turn
  // WhatsApp on before its template is approved, it just cannot create a
  // WhatsApp campaign until this is set (checked at campaign creation, not
  // here).
  templateName: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v)),
  // The gym's OWN WhatsApp sender, E.164. Never casdey's: the WhatsApp display
  // name belongs to the number, so a number shared across gyms could only ever
  // introduce itself as casdey to somebody's lapsed members. Blank is allowed
  // and simply means this gym cannot send WhatsApp yet.
  whatsappFrom: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s()\-.]/g, ""))
    .refine((v) => v === "" || /^\+[1-9][0-9]{6,14}$/.test(v), {
      message:
        "Enter the number in full international format, starting with + and the country code.",
    })
    .transform((v) => (v === "" ? null : v)),
});

export async function saveWhatsAppSettingsAction(
  _previous: WhatsAppSettingsState,
  formData: FormData,
): Promise<WhatsAppSettingsState> {
  const { gym, session } = await requireOwner();

  const parsed = Schema.safeParse({
    enabled: formData.get("enabled") === "on",
    templateName: formData.get("templateName") ?? "",
    whatsappFrom: formData.get("whatsappFrom") ?? "",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form.",
      saved: false,
    };
  }

  const { error } = await supabaseAdmin()
    .from("gyms")
    .update({
      whatsapp_enabled: parsed.data.enabled,
      whatsapp_template_name: parsed.data.templateName,
      whatsapp_from: parsed.data.whatsappFrom,
    })
    .eq("id", gym.id);

  if (error) {
    console.error("[whatsapp settings] update failed", error.message);
    return { error: "We could not save that. Try again.", saved: false };
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "whatsapp.settings_updated",
    meta: { enabled: parsed.data.enabled },
  });

  revalidatePath("/app", "layout");
  return { error: null, saved: true };
}
