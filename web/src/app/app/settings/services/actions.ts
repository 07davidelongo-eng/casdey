"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOwner } from "@/lib/dal";
import { supabaseAdmin } from "@/lib/supabase";
import { recordAudit } from "@/lib/audit";
import { BILLING_PERIODS } from "@/lib/services";

export type ServicesState = { error: string | null; saved: boolean };

/**
 * One row from the form. Existing rows carry their id so a price edit updates in
 * place and keeps the id anything else might reference; new rows have no id yet.
 * Price arrives in major units (what the gym typed) and is stored in minor.
 */
const Row = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1, "Give each service a name.").max(120),
  description: z.string().trim().max(300).default(""),
  price: z
    .number({ message: "Enter each price as a number." })
    .min(0, "A price cannot be negative.")
    .max(1_000_000, "That price is higher than casdey will store."),
  billingPeriod: z.enum(BILLING_PERIODS),
  active: z.boolean(),
  bookable: z.boolean(),
  // Null means "inherit the gym's own booking defaults", which is what most
  // gyms want and what every service starts as.
  durationMinutes: z
    .number()
    .int()
    .min(5, "A bookable service has to run for at least five minutes.")
    .max(480, "Eight hours is the longest slot casdey will offer.")
    .nullable(),
  bufferMinutes: z
    .number()
    .int()
    .min(0)
    .max(240, "Four hours is the longest gap casdey will keep clear.")
    .nullable(),
  capacity: z
    .number()
    .int()
    .min(1, "A service needs at least one place.")
    .max(500, "Five hundred places is the most casdey will hold in one slot."),
  billingInterval: z
    .number()
    .int()
    .min(1, "Charge at least once per period.")
    .max(52, "Fifty two periods is the longest gap casdey will hold.")
    .default(1),
});

const Schema = z
  .array(Row)
  .max(300, "That is more services than casdey will store for one gym.");

export async function saveServices(
  rows: unknown,
): Promise<ServicesState> {
  const { gym, session } = await requireOwner();

  const parsed = Schema.safeParse(rows);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the prices.", saved: false };
  }

  const submitted = parsed.data;
  const client = supabaseAdmin();

  // What the gym has now, to work out what to remove.
  const { data: existingRows, error: readError } = await client
    .from("services")
    .select("id")
    .eq("gym_id", gym.id);

  if (readError) {
    console.error("[services] read failed", readError.message);
    return { error: "We could not save that. Try again.", saved: false };
  }

  const existingIds = new Set((existingRows ?? []).map((r) => r.id as string));
  const keptIds = new Set(
    submitted.map((r) => r.id).filter((id): id is string => id !== null),
  );

  // Rows the gym removed in the form are the existing ids no longer present.
  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));

  // Upsert every submitted row. Rows with an id update in place; rows without one
  // are inserted. Position is the order they appear in the form.
  const toUpsert = submitted.map((row, index) => ({
    ...(row.id ? { id: row.id } : {}),
    gym_id: gym.id,
    name: row.name,
    description: row.description || null,
    price_minor: Math.round(row.price * 100),
    billing_period: row.billingPeriod,
    // A one-off is charged once, so an interval on it would be meaningless
    // and is normalised away rather than stored to confuse a later reader.
    billing_interval: row.billingPeriod === "one_off" ? 1 : row.billingInterval,
    active: row.active,
    bookable: row.bookable,
    // Only meaningful on a bookable service. Clearing them when the switch is
    // off keeps a stale 90-minute duration from coming back to life if the
    // gym turns booking on again months later and does not re-read it.
    duration_minutes: row.bookable ? row.durationMinutes : null,
    buffer_minutes: row.bookable ? row.bufferMinutes : null,
    capacity: row.bookable ? row.capacity : 1,
    position: index,
  }));

  if (toUpsert.length > 0) {
    const { error } = await client.from("services").upsert(toUpsert);
    if (error) {
      console.error("[services] upsert failed", error.message);
      return { error: "We could not save that. Try again.", saved: false };
    }
  }

  if (toDelete.length > 0) {
    const { error } = await client
      .from("services")
      .delete()
      .eq("gym_id", gym.id)
      .in("id", toDelete);
    if (error) {
      console.error("[services] delete failed", error.message);
      return { error: "We saved your changes but could not remove a row. Reload and try again.", saved: false };
    }
  }

  await recordAudit({
    gymId: gym.id,
    actorId: session.userId,
    actorEmail: session.email,
    action: "gym.services_updated",
    meta: { count: submitted.length },
  });

  revalidatePath("/app/settings/services");
  return { error: null, saved: true };
}
