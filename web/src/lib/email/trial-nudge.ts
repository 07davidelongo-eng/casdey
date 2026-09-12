import "server-only";

import { emailProvider, siteUrl } from "../messaging";
import { conversionAmountMinor } from "../trial";
import { currencyFor } from "../countries";
import { formatMoney } from "../money";

/**
 * The emails during the paid first week, on days 2, 5 and 6.
 *
 * These now carry the whole weight of activation. Under the old design a setup
 * fee at day 7 did that job and these were its warning shots; the fee is gone
 * (see the note at the top of ../trial.ts), so nothing else stands between a
 * gym signing up and a gym drifting. That changes what they have to say. Days 2
 * and 5 are not administrative reminders, they lead with what the gym is not
 * seeing yet, because the money sitting in a lapsed list is the only argument
 * casdey has before it has produced a result.
 *
 * Day 6 is different in kind and is the most important message casdey sends:
 * it is the only warning before a card is charged a few hundred euro. It names
 * the exact amount, the exact date, and how to stop it, and it goes out whether
 * or not the gym finished its setup. A charge nobody saw coming is the one
 * outcome worth avoiding, and it is also how a conversion becomes a chargeback.
 *
 * They go from casdey to the gym owner, so unlike a win-back message they use
 * casdey's own identity rather than the gym's. This shares the Resend quota
 * with the cold outreach (see the Resend note in CLAUDE.md); at three emails
 * per gym that is noise, not a problem.
 */

type NudgeGym = {
  id: string;
  name: string;
  country: string;
  contact_email: string;
  early_adopter: boolean;
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
  const amount = conversionAmountMinor(currency, gym.early_adopter);
  const steps = outstanding.map((label) => `  - ${label}`).join("\n");
  const app = `${siteUrl()}/app`;

  const { subject, body } = compose({
    day,
    firstName: gym.name,
    steps,
    count: outstanding.length,
    // A missing price would be a misconfigured environment, not a free ride.
    // Saying "your plan price" is vague but true; inventing a number is not.
    charge: amount == null ? "your Pro plan price" : formatMoney(amount, currency),
    discounted: gym.early_adopter,
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
  charge,
  discounted,
  app,
}: {
  day: number;
  firstName: string;
  steps: string;
  count: number;
  charge: string;
  discounted: boolean;
  app: string;
}): { subject: string; body: string } {
  const thing = count === 1 ? "one thing" : `${count} things`;

  if (day <= 2) {
    return {
      subject: "your casdey week has started",
      body: `Hi ${firstName},

Your week of Pro is running. The fastest way to see whether casdey is worth keeping is to import your member list, which takes a few minutes and needs nothing from you but an export.

The moment it lands you will see how many members have gone quiet and roughly what that is worth a month, before you write a single message. That number is the whole point, and right now casdey cannot show it to you.

${count > 0 ? `Still to do:\n\n${steps}\n\n` : ""}${app}

If your export is awkward, reply and send it to me and I will do the import for you.

Davide @casdey`,
    };
  }

  if (day <= 5) {
    return {
      subject: "two days left on your casdey week",
      body: `Hi ${firstName},

You have two days left on your week of Pro, and ${thing} still to do:

${steps}

It is about ten minutes of work. If any of it is awkward, a CSV that will not export cleanly or prices you are not sure how to enter, reply and I will do it for you rather than let the week go to waste.

${app}

Davide @casdey`,
    };
  }

  return {
    subject: "your casdey week ends tomorrow",
    body: `Hi ${firstName},

Your week of Pro ends tomorrow, so this is the one email that matters.

Unless you cancel before then, your subscription starts and your card is charged ${charge} a month${discounted ? ", which includes your 20% early adopter discount for as long as you stay" : ""}. That is what you signed up for, and I would rather you saw it coming than found it on a statement.

${count > 0 ? `${thing.charAt(0).toUpperCase()}${thing.slice(1)} from setup ${count === 1 ? "is" : "are"} still outstanding:\n\n${steps}\n\nIf that is because the week got away from you, reply today and I will set it up with you before it renews.\n\n` : "Everything is set up, so it will simply carry on.\n\n"}To cancel, open your billing page and click cancel. It takes a second and you will not be charged.

${app}/settings/billing

Davide @casdey`,
  };
}
