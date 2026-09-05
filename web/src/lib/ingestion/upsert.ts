import "server-only";

import { supabaseAdmin } from "../supabase";
import type { RawMember } from "./types";

/**
 * Writing parsed members into the database.
 *
 * Uses the service-role client because this runs as a batch and needs to upsert
 * thousands of rows without a round trip per row. The gym id is pinned by
 * the caller from a verified session and is never read from the request body:
 * that is the only thing standing between this and a cross-tenant write, so it
 * does not move.
 *
 * Repeat imports update rather than duplicate. A gym re-exporting their
 * list every month is the normal case, not the exception.
 */

const BATCH_SIZE = 500;
/** Enough for the gym to see which records to fix, not a copy of the file. */
const MAX_FAILURES = 50;

/** One record the upsert could not write, with something the gym can act on. */
export type UpsertFailure = { ref: string; reason: string; row: number };

export type UpsertResult = {
  imported: number;
  updated: number;
  failed: number;
  /** Ids of members created by this run, for the timeline. */
  newMemberIds: string[];
  /** Per-record reasons for any failures, so a bad row is diagnosable. */
  failures: UpsertFailure[];
};

type Row = {
  gym_id: string;
  import_id: string;
  external_ref: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  last_visit_at: string;
  visit_count: number;
  source: string;
};

function toRow(
  member: RawMember,
  gymId: string,
  importId: string,
  source: string,
): Row {
  return {
    gym_id: gymId,
    import_id: importId,
    external_ref: member.externalRef,
    first_name: member.firstName,
    last_name: member.lastName,
    email: member.email,
    phone: member.phone,
    last_visit_at: member.lastVisitAt,
    visit_count: member.visitCount,
    source,
  };
}

/**
 * There are two ways a member can already exist: by the gym's own
 * reference, or by email. Rows are split so each batch upserts against exactly
 * one conflict target, because Postgres takes one per statement.
 *
 * An upsert only writes the columns given here, so a member's status,
 * contacted_at and returned_at survive a re-import untouched. Re-importing
 * must never resurrect somebody who unsubscribed.
 */
export async function upsertMembers(
  members: RawMember[],
  options: { gymId: string; importId: string; source: string },
): Promise<UpsertResult> {
  const withRef = members.filter((p) => p.externalRef);
  const withEmail = members.filter((p) => !p.externalRef && p.email);
  // Neither, but a phone number. Stored rather than dropped, because on Pro
  // WhatsApp is how these members are reached. See the identity gate in csv.ts.
  const withPhone = members.filter((p) => !p.externalRef && !p.email && p.phone);

  const result: UpsertResult = {
    imported: 0,
    updated: 0,
    failed: 0,
    newMemberIds: [],
    failures: [],
  };

  await run(withRef, "gym_id,external_ref", options, result);
  await run(withEmail, "gym_id,email", options, result);
  await run(withPhone, "gym_id,phone", options, result);

  // A row in none of the three buckets has nothing to identify it by and could
  // never have been written. Reported rather than dropped: every row the gym
  // handed us has to end up in one of the numbers on the import screen.
  for (const member of members) {
    if (member.externalRef || member.email || member.phone) continue;
    recordFailure(
      result,
      member,
      "no email address, phone number or member reference to identify them by",
    );
  }

  return result;
}

/** What the gym calls the column two rows collided on. */
const KEY_LABEL: Record<string, string> = {
  "gym_id,external_ref": "member reference",
  "gym_id,email": "email address",
  "gym_id,phone": "phone number",
};

/**
 * Separates rows that share a conflict key, so a single statement never tries
 * to touch the same target row twice (Postgres rejects the whole batch
 * otherwise).
 *
 * The FIRST occurrence is kept and every later one is handed back as a
 * collision for the caller to report.
 *
 * This used to keep the last occurrence and say nothing, on the reasoning that
 * a later row is more recent data. That reasoning holds ACROSS imports, where
 * a newer file supersedes an older one. It does not hold WITHIN one file, where
 * two rows sharing an email address are usually two different people: a couple
 * on one membership, a family sharing an address, a front-desk placeholder, or
 * a plain typo. Collapsing them deleted one member outright and left the
 * survivor holding somebody else's address, so casdey would greet the wrong
 * person by name at an inbox that was never theirs. The counts said nothing
 * either: eight rows read, five added, two skipped, and no mention of the
 * eighth.
 *
 * Which row survives matters far less than the gym being told, so that they can
 * fix the export. First-wins is simply the order they wrote the file in.
 */
export function dedupeByConflictKey(
  members: RawMember[],
  keyOf: (p: RawMember) => string,
): { kept: RawMember[]; collisions: RawMember[] } {
  const byKey = new Map<string, RawMember>();
  const collisions: RawMember[] = [];

  for (const member of members) {
    const key = keyOf(member);
    if (byKey.has(key)) collisions.push(member);
    else byKey.set(key, member);
  }

  return { kept: [...byKey.values()], collisions };
}

/** One unwritable record, capped so a broken file cannot return a novel. */
function recordFailure(
  result: UpsertResult,
  member: RawMember,
  reason: string,
): void {
  result.failed += 1;
  if (result.failures.length >= MAX_FAILURES) return;
  result.failures.push({
    row: member.sourceRow,
    ref:
      member.externalRef ||
      member.email ||
      member.phone ||
      [member.firstName, member.lastName].filter(Boolean).join(" ") ||
      `row ${member.sourceRow}`,
    reason,
  });
}

async function run(
  members: RawMember[],
  onConflict: string,
  options: { gymId: string; importId: string; source: string },
  result: UpsertResult,
): Promise<void> {
  const client = supabaseAdmin();
  const keyOf: (p: RawMember) => string = onConflict.endsWith("external_ref")
    ? (p) => p.externalRef ?? ""
    : onConflict.endsWith("phone")
      ? (p) => p.phone ?? ""
      : (p) => (p.email ?? "").toLowerCase();

  const { kept, collisions } = dedupeByConflictKey(members, keyOf);

  const label = KEY_LABEL[onConflict] ?? "identifier";
  for (const member of collisions) {
    recordFailure(
      result,
      member,
      `this ${label} is already used by an earlier row in the same file, so this record was not imported. If they are two different people, give them different details and import again`,
    );
  }

  for (let start = 0; start < kept.length; start += BATCH_SIZE) {
    const slice = kept.slice(start, start + BATCH_SIZE);
    const rows = slice.map((member) =>
      toRow(member, options.gymId, options.importId, options.source),
    );

    const { data, error } = await client
      .from("members")
      .upsert(rows, { onConflict, ignoreDuplicates: false })
      .select("id, created_at, updated_at");

    if (error) {
      // A whole batch failing usually means one offending row (a row that
      // collides with the *other* unique index, e.g. an external-ref row whose
      // email already belongs to a different member). Retry the slice one row
      // at a time so a single bad record can't drop the other 499, and record
      // which record failed and why instead of a silent aggregate.
      console.error("[import] batch failed, retrying row by row", error.code);
      await runRowByRow(client, slice, onConflict, options, result);
      continue;
    }

    // Postgres does not report insert-versus-update on a conflict. A row whose
    // updated_at still equals its created_at was created by this statement, and
    // the touch_updated_at trigger guarantees an updated row moves on.
    for (const row of data ?? []) {
      if (row.created_at === row.updated_at) {
        result.imported += 1;
        result.newMemberIds.push(row.id as string);
      } else {
        result.updated += 1;
      }
    }
  }
}

/** Fallback for a batch that errored: isolate each row so one can't sink many. */
async function runRowByRow(
  client: ReturnType<typeof supabaseAdmin>,
  slice: RawMember[],
  onConflict: string,
  options: { gymId: string; importId: string; source: string },
  result: UpsertResult,
): Promise<void> {
  for (const member of slice) {
    const row = toRow(member, options.gymId, options.importId, options.source);
    const { data, error } = await client
      .from("members")
      .upsert(row, { onConflict, ignoreDuplicates: false })
      .select("id, created_at, updated_at")
      .maybeSingle();

    if (error) {
      recordFailure(
        result,
        member,
        error.code === "23505"
          ? "these details already belong to another member in this gym"
          : error.message,
      );
      continue;
    }

    if (data) {
      if (data.created_at === data.updated_at) {
        result.imported += 1;
        result.newMemberIds.push(data.id as string);
      } else {
        result.updated += 1;
      }
    }
  }
}

/**
 * Gives every newly created member a starting point on their timeline.
 *
 * Only new ones: a gym re-uploading the same list every month would
 * otherwise stack an "imported" event on every member every time, and the
 * timeline stops meaning anything.
 *
 * Best effort. An import that stored members correctly must not be reported as
 * failed because its timeline rows did not write.
 */
export async function recordImportEvents(
  gymId: string,
  importId: string,
  memberIds: string[],
): Promise<void> {
  if (memberIds.length === 0) return;
  const client = supabaseAdmin();

  for (let start = 0; start < memberIds.length; start += BATCH_SIZE) {
    const events = memberIds.slice(start, start + BATCH_SIZE).map((id) => ({
      gym_id: gymId,
      member_id: id,
      type: "imported",
      meta: { import_id: importId },
    }));

    const { error } = await client.from("member_events").insert(events);
    if (error) {
      console.error("[import] events failed", error.message);
      return;
    }
  }
}
