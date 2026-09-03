/**
 * The first-run setup checklist.
 *
 * Self-serve onboarding lives or dies on a gym owner knowing what to do next.
 * The product has all the pieces (import, lapse window, booking value, calendar,
 * first campaign) but before this they were scattered across the dashboard and
 * Settings with no single "you are not done yet" spine, and two of the five
 * steps (booking value, calendar) had nothing pointing at them at all.
 *
 * This derives the checklist purely from state the gym already has, so there is
 * no flag to keep in sync and no migration: a step is done because the thing it
 * asks for exists, and the panel disappears on its own once every countable
 * step is done. Kept free of any imports so it can be unit tested directly.
 */

export type SetupStepKey =
  | "import"
  | "lapse"
  | "value"
  | "calendar"
  | "campaign";

export type SetupStep = {
  key: SetupStepKey;
  title: string;
  body: string;
  href: string;
  cta: string;
  done: boolean;
  /** Encouraged but does not hold back "all set" (a gym can work without it). */
  optional: boolean;
  /** The server cannot offer this step yet (e.g. calendar not configured).
   *  Shown greyed out and never counted for or against completion. */
  unavailable: boolean;
};

export type SetupState = {
  steps: SetupStep[];
  /** Countable = not unavailable. */
  doneCount: number;
  total: number;
  /** Every countable, non-optional step is done. */
  complete: boolean;
};

export type SetupInput = {
  memberCount: number;
  bookingValueSet: boolean;
  lapsedAfterMonths: number;
  maxVisits: number;
  /** The server has Google Calendar wired up (client + token key). */
  calendarConfigured: boolean;
  calendarConnected: boolean;
  hasApprovedCampaign: boolean;
};

export function buildSetupState(input: SetupInput): SetupState {
  const hasMembers = input.memberCount > 0;
  const visitText =
    input.maxVisits === 1 ? "one visit" : `${input.maxVisits} visits`;

  const steps: SetupStep[] = [
    {
      key: "import",
      title: "Import your members",
      body: "A CSV export from your gym software. casdey finds who came once or twice and never came back.",
      href: "/app/import",
      cta: "Import your list",
      done: hasMembers,
      optional: false,
      unavailable: false,
    },
    {
      key: "lapse",
      title: "Check how you define lapsed",
      body: `Currently: no visit for ${input.lapsedAfterMonths} months, and at most ${visitText} on record. Change it in settings if your gym works differently.`,
      href: "/app/settings",
      cta: "Review the window",
      // A sensible default is already in effect the moment a list exists, so
      // this is confirmed once there are members. It stays on the list so the
      // owner sees the rule and can correct it, not because it blocks them.
      done: hasMembers,
      optional: false,
      unavailable: false,
    },
    {
      key: "value",
      title: "Set what a return is worth",
      body: "Tell casdey the typical value of a recovered member. It powers the revenue estimate and the profit-or-nothing guarantee.",
      href: "/app/settings",
      cta: "Set booking value",
      done: input.bookingValueSet,
      optional: false,
      unavailable: false,
    },
    {
      key: "calendar",
      title: "Connect your calendar",
      body: "Connect Google Calendar and casdey books returning members straight in, and never offers a slot you are already in.",
      href: "/app/settings/booking",
      cta: "Connect calendar",
      done: input.calendarConnected,
      // Booking works without a calendar, so this never blocks completion.
      optional: true,
      unavailable: !input.calendarConfigured,
    },
    {
      key: "campaign",
      title: "Approve your first campaign",
      body: "Review the win-back message casdey drafts in your gym's name. Nothing goes out until you approve it.",
      href: "/app/campaigns/new",
      cta: "Build a campaign",
      done: input.hasApprovedCampaign,
      optional: false,
      unavailable: false,
    },
  ];

  const countable = steps.filter((step) => !step.unavailable);
  const doneCount = countable.filter((step) => step.done).length;
  const complete = countable
    .filter((step) => !step.optional)
    .every((step) => step.done);

  return { steps, doneCount, total: countable.length, complete };
}
