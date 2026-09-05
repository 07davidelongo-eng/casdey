/**
 * The first-run setup checklist.
 *
 * Self-serve onboarding lives or dies on a gym owner knowing what to do next.
 * The product has all the pieces but before this they were scattered across the
 * dashboard and Settings with no single "you are not done yet" spine, and
 * several of them (booking value, calendar, the offer, per-gym sending) had
 * nothing pointing at them at all: a feature nobody is told about may as well
 * not be built.
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
  | "offer"
  | "sending"
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
  /** The gym has chosen a win-back offer. */
  offerChosen: boolean;
  /** The server can manage sending domains at all (a Resend key that is
   *  allowed to touch /domains). */
  sendingConfigured: boolean;
  /** The gym's own domain is verified, not merely started. */
  sendingVerified: boolean;
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
      key: "offer",
      title: "Decide what they are coming back for",
      body: "casdey writes the message, but the offer inside it is yours. A few questions and you have a dated one your members can act on.",
      href: "/app/offer",
      cta: "Build your offer",
      done: input.offerChosen,
      // Not optional, and deliberately ahead of the campaign step. A win-back
      // message with nothing to come back for recovers nobody, the gym
      // concludes casdey does not work, and on Pro that failure is casdey's to
      // refund. Choosing to make no promise is a fine answer, but it should be
      // a choice rather than an omission.
      optional: false,
      unavailable: false,
    },
    {
      key: "sending",
      title: "Send from your own address",
      body: "Verify your gym's domain and win-back messages leave from your address rather than ours. Members recognise the sender, and more of it reaches the inbox.",
      href: "/app/settings/sending",
      cta: "Set up sending",
      done: input.sendingVerified,
      // Mail already carries the gym's name without this, so it never blocks
      // a gym from getting started. It is on the list because it was
      // invisible: nothing outside Settings pointed at it.
      optional: true,
      unavailable: !input.sendingConfigured,
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
