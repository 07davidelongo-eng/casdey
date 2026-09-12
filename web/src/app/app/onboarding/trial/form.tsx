"use client";

import { useId, useState } from "react";

import { Button } from "@/components/app/ui";

/**
 * The commitment ask and the billing terms.
 *
 * Two checkboxes doing deliberately different jobs. The commitment is
 * optional, because it is an affirmative commitment and an answer extracted by
 * making it mandatory is not one: the value is in being asked, and in whether
 * the gym chooses to say yes. The terms are required, because a gym cannot be
 * charged on day 7 for something it never ticked.
 *
 * The terms used to describe a setup fee for activation steps left unfinished.
 * That mechanism was removed on 2026-09-12 (see ../../../lib/trial.ts), so what
 * is left is the ordinary thing: a week is bought, it renews, cancelling is
 * free. The renewal figure is named rather than left to "then our normal
 * price", because it is the number the gym is actually agreeing to.
 */
export function TrialStartForm({
  price,
  monthly,
  list,
  error,
}: {
  price: string;
  monthly: string | null;
  /** The undiscounted monthly price, or null when the gym is paying it. The
   *  terms have to name the rate being agreed to AND where it came from, or
   *  the figure looks arbitrary and the discount goes unnoticed. */
  list: string | null;
  error: string | null;
}) {
  const id = useId();
  const [terms, setTerms] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <form
      action="/api/stripe/trial/start"
      method="post"
      onSubmit={() => setPending(true)}
      className="card p-6"
    >
      <label
        htmlFor={`${id}-commit`}
        className="flex cursor-pointer gap-3 text-[0.9375rem]"
      >
        <input
          id={`${id}-commit`}
          type="checkbox"
          name="commitment"
          value="yes"
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--teal)]"
        />
        <span>
          If casdey brings members back, I intend to stay on afterwards.
        </span>
      </label>

      <hr className="my-5 border-ash" />

      <label
        htmlFor={`${id}-terms`}
        className="flex cursor-pointer gap-3 text-[0.9375rem]"
      >
        <input
          id={`${id}-terms`}
          type="checkbox"
          name="terms"
          value="yes"
          required
          checked={terms}
          onChange={(event) => setTerms(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--teal)]"
        />
        <span>
          I understand <span className="literal">{price}</span> is charged today
          for my first week of Pro, and that it then continues
          {monthly ? (
            <>
              {" "}
              at <span className="literal">{monthly}</span> a month
              {list ? (
                <>
                  {" "}
                  (the launch rate, down from{" "}
                  <span className="literal">{list}</span>, for as long as I
                  stay)
                </>
              ) : null}
            </>
          ) : null}{" "}
          until I cancel. If I cancel during the week I pay nothing beyond
          today&apos;s <span className="literal">{price}</span>.
        </span>
      </label>

      {error ? (
        <p role="alert" className="notice notice-error mt-5">
          {error === "terms"
            ? "Tick the box to confirm you have read the terms, then try again."
            : error === "cancelled"
              ? "You closed the payment page before it finished. Nothing was charged."
              : "We could not open the payment page. Try again, and tell us if it keeps happening."}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={!terms || pending}
        className="mt-6 w-full"
      >
        {pending ? "Opening Stripe" : `Start my week for ${price}`}
      </Button>

      <p className="mt-3 text-center text-[0.8125rem] text-stone">
        You can cancel any time during the week from your billing page.
      </p>
    </form>
  );
}
