import type { CampaignKind } from "./types";

/**
 * A campaign's follow-up steps.
 *
 * One message and then silence is not what casdey sells. The promise is a
 * member of staff who chases the people who stopped coming, and staff follow
 * up. casdey's own cold outreach has run two follow-ups since September 2026
 * for exactly this reason, while the product it sells wrote once and stopped.
 *
 * Two, not five. Past the second nudge a win-back message stops reading as
 * attentive and starts reading as pestering, and it is the gym's name on it,
 * not casdey's. The second one is a walk-away: it says outright that it is the
 * last, which is what makes the whole sequence feel like a person rather than
 * a drip campaign.
 */

export type FollowUp = {
  /** Days after the previous step actually sent, not after the campaign began. */
  afterDays: number;
  subject: string;
  body: string;
};

export const MAX_FOLLOW_UPS = 2;

/** Bounds, shared by the form and the server validation. */
export const MIN_FOLLOW_UP_DAYS = 1;
export const MAX_FOLLOW_UP_DAYS = 60;

const WIN_BACK_FOLLOW_UPS: FollowUp[] = [
  {
    afterDays: 4,
    subject: "Following up",
    body: `Hi {{first_name}},

I wrote a few days ago and I know how easily these things get buried, so this is just a nudge in case it did.

The offer still stands, and coming back in does not have to mean picking up where you left off. One session is fine.

{{gym}}`,
  },
  {
    afterDays: 7,
    subject: "Last one from me",
    body: `Hi {{first_name}},

This is the last time I will write about this, so nothing more from us after today.

If you ever want to come back, you would be welcome, and you know where we are.

{{gym}}`,
  },
];

const AT_RISK_FOLLOW_UPS: FollowUp[] = [
  {
    afterDays: 6,
    subject: "Still here if you need anything",
    body: `Hi {{first_name}},

Just following up on my note from last week, no pressure at all.

If something is getting in the way of getting in, tell me what it is and I will see what we can do about it.

{{gym}}`,
  },
];

/**
 * What a new campaign starts with. A gym can delete or rewrite every word of
 * it, but the default is a sequence, because a gym owner who has never run
 * win-back does not know that the second message is the one that works.
 *
 * An at-risk campaign gets one gentle follow-up rather than two: these members
 * have not gone anywhere, and chasing somebody who is still paying you is a
 * good way to remind them they could stop.
 */
export function defaultFollowUps(kind: CampaignKind): FollowUp[] {
  return kind === "at_risk" ? AT_RISK_FOLLOW_UPS : WIN_BACK_FOLLOW_UPS;
}

/**
 * Reads whatever is on the campaign row, which came from jsonb and is
 * therefore not to be trusted to have any particular shape.
 */
export function parseFollowUps(value: unknown): FollowUp[] {
  if (!Array.isArray(value)) return [];
  const steps: FollowUp[] = [];
  for (const raw of value.slice(0, MAX_FOLLOW_UPS)) {
    if (!raw || typeof raw !== "object") continue;
    const step = raw as Record<string, unknown>;
    const afterDays = Number(step.afterDays);
    const subject = typeof step.subject === "string" ? step.subject : "";
    const body = typeof step.body === "string" ? step.body : "";
    if (!Number.isFinite(afterDays) || afterDays < MIN_FOLLOW_UP_DAYS) continue;
    if (!subject.trim() || !body.trim()) continue;
    steps.push({
      afterDays: Math.min(Math.round(afterDays), MAX_FOLLOW_UP_DAYS),
      subject,
      body,
    });
  }
  return steps;
}

/**
 * The step that follows the one just sent, or null when the sequence is over.
 * Step 1's follow-up is the first entry, so the index is one behind the step.
 */
export function nextStep(
  steps: FollowUp[],
  justSent: number,
): { step: number; follow: FollowUp } | null {
  const follow = steps[justSent - 1];
  return follow ? { step: justSent + 1, follow } : null;
}
