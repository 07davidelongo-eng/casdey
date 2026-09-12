import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LAPSE_PRESETS,
  lapseCutoff,
  visitCeiling,
  windowInDays,
  type LapseRule,
} from "./lapse";

/**
 * What each candidate lapse window would actually catch, counted against the
 * gym's own members.
 *
 * The lapse window was the one setting nobody could evaluate. It is a single
 * number on a form, and its consequence, how many people casdey will write
 * to, lives on a different page, so a gym had no way to tell a sensible
 * window from a silly one without saving and going to look. That is most of
 * why the dental 12-month default went unquestioned for a month: it was
 * invisible rather than wrong-looking. See
 * 0037_gym_native_lapse_window.sql.
 *
 * Counted with `head: true`, like everything in ./stats.ts, so this costs a
 * handful of numbers rather than pulling member rows. The gym's visit ceiling
 * is held constant across every row: this table answers "what does the window
 * change", and varying two things at once would answer nothing.
 */

export type LapsePreviewRow = {
  window: LapseRule["window"];
  /** "90 days", "12 months". */
  label: string;
  lapsed: number;
  /** Of those, how many casdey could actually email. */
  reachable: number;
  /** This row is the window the gym is on right now. */
  current: boolean;
};

function label(window: LapseRule["window"]): string {
  const unit = window.value === 1 ? window.unit.slice(0, -1) : window.unit;
  return `${window.value} ${unit}`;
}

export async function lapsePreview(
  supabase: SupabaseClient,
  gymId: string,
  rule: LapseRule,
  now: Date = new Date(),
): Promise<LapsePreviewRow[]> {
  // The gym's live window always appears, even when it is not one of the
  // presets. A gym that typed 45 days needs to see its own row highlighted,
  // not a table of five windows none of which is theirs.
  const currentDays = windowInDays(rule);
  const windows = [...LAPSE_PRESETS];
  if (!windows.some((w) => windowInDays({ window: w, maxVisits: null }) === currentDays)) {
    windows.push(rule.window);
  }
  windows.sort(
    (a, b) =>
      windowInDays({ window: a, maxVisits: null }) -
      windowInDays({ window: b, maxVisits: null }),
  );

  const counts = await Promise.all(
    windows.map(async (window) => {
      const cutoff = lapseCutoff({ window, maxVisits: rule.maxVisits }, now);

      const base = () =>
        supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("gym_id", gymId)
          // The self-test member is not a real member. Same exclusion as
          // gymStats, or this table would disagree with the dashboard by one.
          .eq("is_test", false)
          .neq("status", "opted_out")
          .lte("visit_count", visitCeiling(rule))
          .lte("last_visit_at", cutoff);

      const [lapsed, reachable] = await Promise.all([
        base(),
        base().not("email", "is", null).eq("consent_email", true),
      ]);

      return {
        window,
        label: label(window),
        lapsed: lapsed.count ?? 0,
        reachable: reachable.count ?? 0,
        current: windowInDays({ window, maxVisits: null }) === currentDays,
      };
    }),
  );

  return counts;
}
