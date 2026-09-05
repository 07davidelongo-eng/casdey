"use client";

import { useActionState, useMemo, useState } from "react";

import { Button, Card, CardTitle, Notice } from "@/components/app/ui";
import {
  BUDGETS,
  DEADLINE_CHOICES,
  GYM_TYPES,
  OFF_PEAK_CHOICES,
  REASONS,
} from "@/lib/offers/questions";
import { OFFERS } from "@/lib/offers/library";
import { deadlineFrom, formatDeadline, rankOffers, renderOffer } from "@/lib/offers/select";
import type { GymType, LapseReason, OfferBudget } from "@/lib/offers/types";
import { chooseOfferAction, type OfferState } from "./actions";
import { EditStep } from "./edit-step";

/**
 * One question per screen, then the offers casdey would suggest.
 *
 * Several suggestions rather than one answer, deliberately: casdey knows the
 * patterns, the gym knows its own room and what it can honour on a Tuesday.
 * Handing back a single answer would claim a certainty this does not have, and
 * a gym that disagrees with the one answer has nowhere to go but away.
 */

type Answers = {
  gymType: GymType | null;
  reason: LapseReason | null;
  budget: OfferBudget | null;
  hasOffPeakCapacity: boolean | null;
  deadlineDays: number | null;
};

const EMPTY: Answers = {
  gymType: null,
  reason: null,
  budget: null,
  hasOffPeakCapacity: null,
  deadlineDays: null,
};

const STEPS = [
  { key: "gymType", title: "What kind of place is this?", why: "Different rooms lose people for different reasons." },
  { key: "reason", title: "Why do members usually stop coming?", why: "This is the one an offer has to answer. Getting it wrong makes the offer irrelevant rather than merely imperfect." },
  { key: "budget", title: "What can you actually afford to give?", why: "casdey will not suggest an offer you cannot honour. A promise broken in public is worse than no offer." },
  { key: "offPeak", title: "Do you have quiet hours worth filling?", why: "An empty spot costs you almost nothing and is worth the same to the member as one that costs you money." },
  { key: "deadline", title: "How long should it stay open?", why: "An offer with no end is not an offer." },
] as const;

export function OfferBuilder({ current }: { current: { id: string | null; text: string | null; expiresAt: string | null } }) {
  const [step, setStep] = useState(0);
  /** The offer the gym picked, held while they edit its wording. */
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [state, formAction, pending] = useActionState<OfferState, FormData>(
    chooseOfferAction,
    { error: null, message: null },
  );

  const complete =
    answers.gymType !== null &&
    answers.reason !== null &&
    answers.budget !== null &&
    answers.hasOffPeakCapacity !== null &&
    answers.deadlineDays !== null;

  const inputs = useMemo(
    () =>
      complete
        ? {
            gymType: answers.gymType as GymType,
            reason: answers.reason as LapseReason,
            budget: answers.budget as OfferBudget,
            hasOffPeakCapacity: answers.hasOffPeakCapacity as boolean,
            deadlineDays: answers.deadlineDays as number,
          }
        : null,
    [complete, answers],
  );

  const ranked = useMemo(() => (inputs ? rankOffers(inputs) : []), [inputs]);
  const deadline = inputs ? deadlineFrom(new Date(), inputs.deadlineDays) : null;

  function pick<K extends keyof Answers>(key: K, value: Answers[K]) {
    setAnswers((a) => ({ ...a, [key]: value }));
    setStep((s) => Math.min(s + 1, STEPS.length));
  }

  const chosen = chosenId ? OFFERS.find((o) => o.id === chosenId) : null;
  if (chosen) {
    // Coming from the questions, offer the fresh suggestion. Coming from the
    // saved offer, show what the gym actually has: their own edits, with the
    // deadline already a real date. Falling back to the library template here
    // would both discard their wording and show them a raw {{deadline}}.
    const suggested = inputs
      ? chosen.dated && deadline
        ? renderOffer(chosen, deadline)
        : chosen.memberFacing
      : (current.text ?? chosen.memberFacing);
    return (
      <div className="space-y-5">
        {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
        <EditStep
          offer={chosen}
          suggested={suggested}
          inputs={inputs}
          formAction={formAction}
          pending={pending}
          onBack={() => setChosenId(null)}
        />
      </div>
    );
  }

  if (current.text && step === 0 && answers.gymType === null) {
    return (
      <CurrentOffer
        current={current}
        onRebuild={() => {
          setAnswers(EMPTY);
          setStep(0);
        }}
        onEdit={() => current.id && setChosenId(current.id)}
      />
    );
  }


  if (step >= STEPS.length && inputs) {
    return (
      <div className="space-y-5">
        {state.error ? <Notice tone="warn">{state.error}</Notice> : null}
        {state.message ? <Notice>{state.message}</Notice> : null}

        <Card>
          <CardTitle>What casdey would offer</CardTitle>
          <p className="mb-1 text-[0.875rem] text-stone">
            Best fit first. Pick the one you can genuinely honour, not the most
            generous: every one of these has to survive contact with a member
            standing at your front desk.
          </p>
          {deadline ? (
            <p className="text-[0.8125rem] text-stone">
              Dated offers will read{" "}
              <span className="literal">{formatDeadline(deadline)}</span>.
            </p>
          ) : null}
        </Card>

        {ranked.map(({ offer }) => (
          <Card key={offer.id}>
            <CardTitle>{offer.name}</CardTitle>
            <p className="mb-4 rounded-md bg-chalk-2 p-3 text-[0.9375rem]">
              {offer.dated && deadline
                ? renderOffer(offer, deadline)
                : offer.memberFacing}
            </p>
            <p className="mb-2 text-[0.875rem] text-stone">
              <strong className="text-ink">Why this works.</strong>{" "}
              {offer.rationale}
            </p>
            <p className="mb-4 text-[0.875rem] text-stone">
              <strong className="text-ink">What it costs you.</strong>{" "}
              {offer.cost}
            </p>
            <Button type="button" onClick={() => setChosenId(offer.id)}>
              Use this offer
            </Button>
          </Card>
        ))}

        <button
          type="button"
          className="text-[0.875rem] text-struck underline"
          onClick={() => {
            setAnswers(EMPTY);
            setStep(0);
          }}
        >
          Start again
        </button>
      </div>
    );
  }

  const current_ = STEPS[step];

  return (
    <Card>
      <p className="label mb-2 text-struck">
        Question {step + 1} of {STEPS.length}
      </p>
      <CardTitle>{current_.title}</CardTitle>
      <p className="mb-5 text-[0.875rem] text-stone">{current_.why}</p>

      <div className="space-y-2">
        {current_.key === "gymType" &&
          GYM_TYPES.map((c) => (
            <ChoiceButton key={c.value} label={c.label} hint={c.hint} onClick={() => pick("gymType", c.value)} />
          ))}
        {current_.key === "reason" &&
          REASONS.map((c) => (
            <ChoiceButton key={c.value} label={c.label} hint={c.hint} onClick={() => pick("reason", c.value)} />
          ))}
        {current_.key === "budget" &&
          BUDGETS.map((c) => (
            <ChoiceButton key={c.value} label={c.label} hint={c.hint} onClick={() => pick("budget", c.value)} />
          ))}
        {current_.key === "offPeak" &&
          OFF_PEAK_CHOICES.map((c) => (
            <ChoiceButton key={String(c.value)} label={c.label} hint={c.hint} onClick={() => pick("hasOffPeakCapacity", c.value)} />
          ))}
        {current_.key === "deadline" &&
          DEADLINE_CHOICES.map((c) => (
            <ChoiceButton key={c.value} label={c.label} hint={c.hint} onClick={() => pick("deadlineDays", c.value)} />
          ))}
      </div>

      {step > 0 ? (
        <button
          type="button"
          className="mt-5 text-[0.875rem] text-stone underline"
          onClick={() => setStep((s) => s - 1)}
        >
          Back
        </button>
      ) : null}
    </Card>
  );
}

function ChoiceButton({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-lg border border-line px-4 py-3 text-left transition hover:border-struck hover:bg-chalk-2"
    >
      <span className="block text-[0.9375rem] font-medium">{label}</span>
      <span className="block text-[0.8125rem] text-stone">{hint}</span>
    </button>
  );
}

function CurrentOffer({
  current,
  onRebuild,
  onEdit,
}: {
  current: { id: string | null; text: string | null; expiresAt: string | null };
  onRebuild: () => void;
  onEdit: () => void;
}) {
  return (
    <Card>
      <CardTitle>Your current offer</CardTitle>
      <p className="mb-4 rounded-md bg-chalk-2 p-3 text-[0.9375rem]">
        {current.text}
      </p>
      <p className="mb-4 text-[0.875rem] text-stone">
        Every campaign you start from now carries this. Changing it here does not
        change offers already sent: a member who was promised something keeps
        being promised it.
      </p>
      <div className="flex gap-2">
        <Button type="button" onClick={onEdit}>
          Edit the wording
        </Button>
        <Button type="button" variant="quiet" onClick={onRebuild}>
          Build a different offer
        </Button>
      </div>
    </Card>
  );
}
