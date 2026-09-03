import { ButtonLink, Card } from "./ui";
import type { SetupState, SetupStep } from "@/lib/setup";

/**
 * The first-run checklist that leads the dashboard until setup is done.
 *
 * Presentational only: it renders the model from buildSetupState(). Once every
 * countable required step is done the dashboard stops rendering this entirely,
 * so there is no "dismiss" to persist.
 */
export function SetupChecklist({ state }: { state: SetupState }) {
  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-[1.25rem]">Finish setting up</h2>
        <p className="label text-stone">
          {state.doneCount} of {state.total} done
        </p>
      </div>

      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-shallow"
        role="progressbar"
        aria-valuenow={state.doneCount}
        aria-valuemin={0}
        aria-valuemax={state.total}
      >
        <div
          className="h-full rounded-full bg-teal transition-[width] duration-500"
          style={{
            width: `${state.total ? (state.doneCount / state.total) * 100 : 0}%`,
          }}
        />
      </div>

      <ol className="mt-5 space-y-1">
        {state.steps.map((step) => (
          <Row key={step.key} step={step} />
        ))}
      </ol>
    </Card>
  );
}

function Row({ step }: { step: SetupStep }) {
  const actionable = !step.done && !step.unavailable;

  return (
    <li className="flex items-start gap-3 rounded-[12px] px-3 py-3 -mx-3 transition-colors hover:bg-paper/60">
      <Marker step={step} />

      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p
            className={`text-[0.9375rem] font-semibold ${
              step.done ? "text-stone line-through" : "text-ink"
            }`}
          >
            {step.title}
            {step.optional && !step.done && !step.unavailable ? (
              <span className="label ml-2 text-stone">optional</span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[0.875rem] text-graphite">
            {step.unavailable
              ? "Not switched on for your account yet. casdey will let you know when it is ready."
              : step.body}
          </p>
        </div>

        {actionable ? (
          <ButtonLink
            href={step.href}
            variant="quiet"
            className="shrink-0 self-start whitespace-nowrap sm:self-center"
          >
            {step.cta}
          </ButtonLink>
        ) : null}
      </div>
    </li>
  );
}

function Marker({ step }: { step: SetupStep }) {
  if (step.done) {
    return (
      <span
        aria-label="done"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal text-white"
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
          <path
            d="M4 10.5l3.5 3.5L16 5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
        step.unavailable ? "border-ash text-stone" : "border-teal text-teal"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  );
}
