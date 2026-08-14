import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { languageEndonym } from "./languages";
import type { DormancyRule } from "./dormancy";

/**
 * Drafting a re-engagement message with Claude.
 *
 * The practice can always write the message by hand, the same template as
 * before. This is the "or let casdey draft it" path: it produces a subject and
 * body in the chosen language, written to casdey's copy rules, with the merge
 * fields left in for the sender to fill per patient. The practice reviews and
 * edits whatever comes back, and nothing is ever sent without their approval.
 *
 * The model is the practice's Claude, not casdey's: it runs on ANTHROPIC_API_KEY
 * from the environment. Without a key set, drafting is unavailable and the
 * practice simply writes the message manually.
 */

// Default to the most capable model; override with CASDEY_AI_MODEL (e.g. a
// cheaper Haiku/Sonnet) once the volume and cost are known.
const MODEL = process.env.CASDEY_AI_MODEL ?? "claude-opus-5";

export type DraftInput = {
  practiceName: string;
  rule: DormancyRule;
  language: string;
  /** Optional steer from the practice: tone, an offer to mention, specifics. */
  guidance?: string;
};

export type Draft = { subject: string; body: string };

export class AiUnavailableError extends Error {}

const SYSTEM = `You write short re-engagement emails that a dental practice sends to a patient it has not seen in a long time. The patient came once or twice and never came back. The practice wants them to book a check-up.

Write as the practice writing to their own patient, warm and plain, never as a marketing campaign. Follow these rules exactly:

- Plain text only. No markdown, no headings, no bullet points, no emoji, no links.
- Never use an em dash (—) anywhere. Use commas or separate sentences. Normal hyphens in words like check-up are fine.
- Keep it short: a few short sentences, the length of a note from a dentist.
- Exactly one thing to do: reply to this email to book a check-up. Do not add phone numbers or other calls to action.
- Use these placeholders where they fit naturally, written exactly like this: {{first_name}} for the patient's first name, {{practice}} for the practice name, {{months_away}} for how many months since their last visit. Open with "Hi {{first_name}}," or the natural equivalent in the target language. End with {{practice}} on its own line.
- Do not write an unsubscribe line; one is added automatically.
- Do not invent facts, offers, prices, treatments, or claims about the patient's health. Only use specifics the practice gives you.
- No "Dear valued customer", no corporate sign-offs like "Best regards".

Return only the subject and body. Both must be written in the requested language.`;

const SCHEMA = {
  type: "object",
  properties: {
    subject: { type: "string" },
    body: { type: "string" },
  },
  required: ["subject", "body"],
  additionalProperties: false,
} as const;

export async function generateCampaignDraft(input: DraftInput): Promise<Draft> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AiUnavailableError(
      "AI drafting is not switched on. Add ANTHROPIC_API_KEY to enable it, or write the message yourself.",
    );
  }

  const client = new Anthropic({ apiKey });

  const guidance = input.guidance?.trim();
  const userParts = [
    `Practice name: ${input.practiceName}`,
    `Language to write in: ${languageEndonym(input.language)}`,
    `The patient came at most ${input.rule.maxVisits} ${
      input.rule.maxVisits === 1 ? "time" : "times"
    } and has not visited for at least ${input.rule.dormantAfterMonths} months.`,
    guidance
      ? `What the practice wants the message to say: ${guidance}`
      : "The practice gave no extra guidance, so keep it general.",
  ];

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      system: SYSTEM,
      messages: [{ role: "user", content: userParts.join("\n") }],
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`The draft could not be generated: ${detail}`);
  }

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to draft that. Try different guidance.");
  }

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("The draft came back empty. Try again.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.text);
  } catch {
    throw new Error("The draft came back in an unexpected format. Try again.");
  }

  const draft = parsed as Partial<Draft>;
  if (
    typeof draft.subject !== "string" ||
    typeof draft.body !== "string" ||
    !draft.subject.trim() ||
    !draft.body.trim()
  ) {
    throw new Error("The draft was missing a subject or body. Try again.");
  }

  return { subject: draft.subject.trim(), body: draft.body.trim() };
}
