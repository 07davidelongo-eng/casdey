import "server-only";

import { emailProvider, siteUrl } from "../messaging";
import { SETUP_FEE_MINOR } from "../trial";
import { currencyFor } from "../countries";
import { formatMoney } from "../money";

/**
 * The trial nudges, on days 2, 5 and 6.
 *
 * These are not a marketing drip and they are load-bearing. $100M Money
 * Models pg 128 is explicit that the fee only works alongside them: "Reach out
 * to people multiple times before you get to this point. Offer to waive the
 * fee if they do." A gym that gets billed on day 7 having heard nothing since
 * signup has a fair complaint, and the fee was never worth a bad review.
 *
 * They go from casdey to the gym owner, so unlike a win-back message they use
 * casdey's own identity rather than the gym's. This shares the Resend quota
 * with the cold outreach (see the Resend note in CLAUDE.md); at three emails
 * per trialing gym that is noise, not a problem.
 *
 * Escalating, and honest at every step. Day 6 names the fee in plain numbers
 * because a charge nobody saw coming is the one outcome worth avoiding, and
 * it always offers both ways out: finish the setup, or cancel and owe nothing.
 */

type NudgeGym = {
  id: string;
  name: string;
  country: string;
  contact_email: string;
};

export async function sendTrialNudge({
  gym,
  day,
  outstanding,
}: {
  gym: NudgeGym;
  day: number;
  /** Human labels for the steps still to do, from ACTIVATION_LABELS. */
  outstanding: string[];
}): Promise<void> {
  const currency = currencyFor(gym.country);
  const perStep = formatMoney(SETUP_FEE_MINOR[currency], currency);
  const total = formatMoney(
    SETUP_FEE_MINOR[currency] * outstanding.length,
    currency,
  );

  const steps = outstanding.map((label) => `  - ${label}`).join("\n");
  const app = `${siteUrl()}/app`;

  const { subject, body } = compose({
    day,
    firstName: gym.name,
    steps,
    count: outstanding.length,
    perStep,
    total,
    app,
  });

  await emailProvider().send({
    to: gym.contact_email,
    fromName: "casdey",
    subject,
    text: body,
    replyTo: "info@casdey.com",
  });
}

function compose({
  day,
  firstName,
  steps,
  count,
  perStep,
  total,
  app,
}: {
  day: number;
  firstName: string;
  steps: string;
  count: number;
  perStep: string;
  total: string;
  app: string;
}): { subject: string; body: string } {
  const thing = count === 1 ? "one thing" : `${count} things`;

  if (day <= 2) {
    return {
      subject: "your casdey week has started",
      body: `Hi ${firstName},

Your free week is running. To see what casdey can actually recover for you it needs ${thing} from you:

${steps}

The first one is the interesting bit. Import your list and you will see how many members have gone quiet and roughly what that is worth a month, before you write a single message.

${app}

If you would rather I set it up with you, reply and we will do it on a call.

Davide @casdey`,
    };
  }

  if (day <= 5) {
    return {
      subject: "two days left on your casdey week",
      body: `Hi ${firstName},

You have two days left on your free week, and ${thing} still to do:

${steps}

It takes about ten minutes. If any of it is awkward, a CSV that will not export cleanly or prices you are not sure how to enter, reply and I will do it for you.

${app}

One thing so nothing is a surprise: when you signed up you agreed to a ${perStep} setup fee per step left unfinished at the end of the week. Finish these and there is nothing to pay. Cancel from your billing page and there is also nothing to pay.

Davide @casdey`,
    };
  }

  return {
    subject: "last day of your casdey week",
    body: `Hi ${firstName},

Your free week ends tomorrow. ${thing === "one thing" ? "One thing is" : `${thing} are`} still outstanding:

${steps}

What happens tomorrow, plainly:

  - Finish these and your account moves onto Pro and starts billing monthly.
  - Do nothing and you will be charged ${total} (${perStep} per unfinished step) and your account drops to the free plan.
  - Cancel before then and you pay nothing at all.

${app}

If you want the fee waived because this week got away from you, reply and say so. I would rather set your account up properly than charge you for not having done it.

Davide @casdey`,
  };
}
