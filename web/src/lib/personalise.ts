import "server-only";

import { renderTemplate, type TemplateContext } from "./template";

/**
 * One message, written for the one person it is going to.
 *
 * The difference this makes is the whole product claim. A template with
 * {{first_name}} in it is a mail merge, and members can tell; casdey sells a
 * member of staff who noticed you stopped coming, and staff write differently
 * to the person who left over money than to the one who hurt their shoulder.
 *
 * Three rules hold the whole thing up, and all three exist because this text
 * goes out under the GYM's name, not casdey's:
 *
 *   1. It rewrites, it does not invent. The model is given the gym's own
 *      message and the handful of facts casdey actually holds, and told that
 *      anything else does not exist. A message that invents a class time or a
 *      price is worse than no message at all, because the member turns up.
 *   2. The gym's offer is reproduced word for word when the gym put it in the
 *      message, and does not appear at all when it did not. It is a promise
 *      about money: a paraphrase of "two free weeks" is a different offer, and
 *      an offer added to a message that never carried one is a discount the
 *      gym never agreed to give.
 *   3. Failure is never fatal. Anything at all going wrong returns null and
 *      the caller sends the template instead. A member getting the ordinary
 *      message is a non-event; a member getting nothing because a model was
 *      busy is a lost customer.
 */

const MODEL = process.env.CASDEY_PERSONALISE_MODEL ?? "claude-haiku-4-5-20251001";

/** Long enough for a short note, short enough that a runaway costs nothing. */
const MAX_TOKENS = 600;

/**
 * A single call, capped hard. The send loop has a fixed budget per run and
 * personalisation is the optional part of it: better to send the template on
 * time than to hold the queue for a model that is thinking.
 */
const TIMEOUT_MS = 12_000;

export function isPersonalisationConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type PersonaliseInput = {
  gymName: string;
  /** The gym's own message, still holding its placeholders. */
  template: string;
  context: TemplateContext;
  /** Which step of the sequence this is, so a follow-up sounds like one. */
  step: number;
};

function systemPrompt(gymName: string): string {
  return `You write short re-engagement messages on behalf of ${gymName}, a gym, to a member who stopped coming. You are writing as the gym, in the first person. The member believes a person at the gym wrote this, and that has to be true of the words even though it is not true of the author.

You will be given the gym's own version of the message and the only facts known about this member. Rewrite the gym's message for this one person.

Hard rules:
- Use ONLY the facts given. You do not know their goals, their job, their training history, which classes they took, why they joined, or anything a person at the front desk would know. If a fact is not listed, it does not exist and must not be implied.
- If an offer is given, reproduce it word for word somewhere in the message. Do not reword it, round it, or restate its deadline differently. It is a promise about money.
- If a booking link is given, keep it exactly as written, on its own line.
- Keep the gym's meaning, structure and intent. You are rewriting their message, not replacing it with yours.
- Plain text. No markdown, no headings, no bullet points, no subject line, no signature block beyond how the gym's own version signs off.
- Similar length to the gym's version, and never longer than it by much. Short reads as human; long reads as marketing.
- Warm, direct, specific. No manufactured urgency, no guilt, no "we miss you!", no exclamation marks.
- Never use an em dash. Use commas or separate sentences.
- Write in the same language as the gym's version.
- Reply with the message itself and nothing else. No preamble, no explanation, no quotes around it.`;
}

/**
 * Whether the gym actually put its offer in THIS message.
 *
 * The offer lives on the gym row, not on the campaign, so it outlives the
 * campaign that introduced it. A gym that ran a discount in March and writes a
 * plain "how are you getting on?" check-in in September is not offering
 * anything, and the member must not be told otherwise: an offer is a promise
 * about money, and casdey only relays the promises the gym actually made.
 *
 * Read off the RENDERED template rather than the raw one, so a gym that typed
 * its offer out by hand counts exactly the same as one that used {{offer}}.
 */
function offerInTemplate(input: PersonaliseInput): boolean {
  const offer = input.context.offer?.trim();
  if (!offer) return false;
  return renderTemplate(input.template, input.context).includes(offer);
}

function factsBlock(input: PersonaliseInput): string {
  const { context, step } = input;
  const facts: string[] = [];

  facts.push(
    context.firstName
      ? `First name: ${context.firstName}`
      : "First name: not known, so do not open with a name",
  );

  if (context.monthsAway !== null) {
    facts.push(`Months since their last visit: ${context.monthsAway}`);
  }

  if (context.reason) {
    facts.push(
      `Why they left, as recorded by the gym: ${context.reason}. Acknowledge it once, lightly, without making it the whole message and without apologising for it.`,
    );
  } else {
    facts.push(
      "Why they left: not known. Do not guess at it or imply you know.",
    );
  }

  if (offerInTemplate(input)) {
    facts.push(`Offer, to be reproduced word for word: ${context.offer}`);
  } else {
    facts.push(
      "Offer: none. Do not invent one, and do not hint that something is available.",
    );
  }

  if (context.bookingUrl) {
    facts.push(`Booking link, to be kept exactly: ${context.bookingUrl}`);
  }

  if (step > 1) {
    facts.push(
      `This is message ${step} in a sequence. They did not reply to the earlier ones. Acknowledge that briefly and do not repeat what was already said.`,
    );
  }

  return facts.join("\n");
}

/**
 * The rewritten message, or null to fall back to the template.
 *
 * Never throws. Every failure path returns null, because the caller is in the
 * middle of a send and the correct response to a bad model reply is the
 * gym's own perfectly good message.
 */
export async function personalise(
  input: PersonaliseInput,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  // The template with its placeholders already resolved, so the model is
  // reading the same words the member would have, not {{first_name}}.
  const rendered = renderTemplate(input.template, input.context);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt(input.gymName),
        messages: [
          {
            role: "user",
            content: `The gym's own message:\n\n${rendered}\n\nWhat is known about this member:\n\n${factsBlock(input)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[personalise] api failed", response.status);
      return null;
    }

    const json = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text = (json.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("")
      .trim();

    return acceptable(text, input) ? text : null;
  } catch (error) {
    console.error(
      "[personalise] failed",
      error instanceof Error ? error.message : error,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * What gets rejected, and why each check earns its place.
 *
 * A model reply is not trusted because it came back 200. These are cheap,
 * and every one of them fails safe: rejection costs a member the personalised
 * version and gets them the gym's message instead.
 */
export function acceptable(text: string, input: PersonaliseInput): boolean {
  if (!text) return false;

  // Nothing this short is a message, and nothing this long is one either.
  if (text.length < 40) return false;
  if (text.length > 2000) return false;

  // The offer is a promise about money, and it cuts both ways.
  //
  // If the gym put its offer in this message it has to survive verbatim: a
  // paraphrase of "two free weeks" is a different promise. If the gym did NOT
  // put it in, it must not appear at all, or personalisation would spend the
  // gym's margin on a discount it never chose to give.
  //
  // The second check only catches the offer reproduced word for word, which is
  // what the prompt asks the model to do with an offer it has been given. The
  // real defence against a paraphrased one is factsBlock telling the model
  // there is no offer; this is the cheap backstop behind it.
  const offer = input.context.offer?.trim();
  if (offer) {
    const carried = offerInTemplate(input);
    if (carried && !text.includes(offer)) return false;
    if (!carried && text.includes(offer)) return false;
  }

  // A booking link that got reworded is a dead link.
  if (input.context.bookingUrl && !text.includes(input.context.bookingUrl)) {
    return false;
  }

  // Unfilled placeholders mean it copied the template's machinery rather than
  // reading it.
  if (/\{\{\s*\w+\s*\}\}/.test(text)) return false;

  // Left-over markdown, or the model talking about the task instead of doing
  // it. Both read as obviously machine-written, which is the one thing this
  // feature exists to avoid.
  if (/^(here|sure|certainly|i'?ve|of course)\b/i.test(text)) return false;
  if (/^#{1,6}\s/m.test(text)) return false;
  if (/\*\*/.test(text)) return false;

  // casdey's own copy rule, applied to text going out in a gym's name.
  if (text.includes("—")) return false;

  return true;
}
