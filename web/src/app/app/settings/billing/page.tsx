import { requireGym } from "@/lib/dal";
import { currencyFor } from "@/lib/countries";
import {
  earlyAdopterProgramActive,
  effectivePlan,
  isPaidPlan,
  planLabel,
  trialDaysLeft,
} from "@/lib/plan";
import { isStripeConfigured, plansFor } from "@/lib/stripe";
import { loadGuaranteeLedgerForStatus, loadGuaranteeStatus } from "@/lib/guarantee-data";
import { formatMoney, gymCurrency } from "@/lib/money";
import {
  Button,
  Card,
  CardTitle,
  Notice,
  Pill,
  formatDate,
} from "@/components/app/ui";
import { GuaranteeClaimForm } from "./guarantee-claim-form";

export const metadata = { title: "Billing" };

export default async function BillingPage(
  props: PageProps<"/app/settings/billing">,
) {
  const params = await props.searchParams;
  const { gym, role, session } = await requireGym();

  const plan = effectivePlan(gym);
  const currency = currencyFor(gym.country);
  const plans = plansFor(currency);
  const daysLeft = trialDaysLeft(gym);
  const discounted = gym.early_adopter && earlyAdopterProgramActive();
  const errorMessage = typeof params.error === "string" ? params.error : null;
  const guarantee = await loadGuaranteeStatus(session.supabase, gym);
  const guaranteeCurrency = gymCurrency(gym);
  const guaranteeLedger = await loadGuaranteeLedgerForStatus(
    session.supabase,
    gym,
    guarantee,
  );

  return (
    <div className="max-w-[44rem] space-y-6">
      {params.welcome ? (
        <Notice>
          You are set up and your free week has started. Everything is unlocked,
          no card needed.
        </Notice>
      ) : null}
      {params.upgraded ? (
        <Notice>Welcome to Premium. Sending is on.</Notice>
      ) : null}
      {params.cancelled ? (
        <Notice>Checkout was cancelled, so nothing changed.</Notice>
      ) : null}
      {params.refunded ? (
        <Notice>
          Refunded. It can take a few days to show up, depending on your bank.
        </Notice>
      ) : null}
      {errorMessage ? <Notice tone="error">{errorMessage}</Notice> : null}

      {!isStripeConfigured() ? (
        <Notice tone="error">
          Stripe is not configured on this environment, so upgrading will not
          open. Set STRIPE_SECRET_KEY and the price ids in the environment.
        </Notice>
      ) : null}

      {/* Current standing */}
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <CardTitle>Your plan</CardTitle>
          <PlanPill plan={planLabel(plan)} />
        </div>

        {plan === "trial" ? (
          <p className="text-[0.9375rem] text-graphite">
            You are on the free week{" "}
            {daysLeft !== null ? (
              <>
                with{" "}
                <span className="literal text-ink">
                  {daysLeft} {daysLeft === 1 ? "day" : "days"}
                </span>{" "}
                left
              </>
            ) : null}
            . Everything works, including sending. When it ends you drop to the
            Free plan, and nothing is charged.
          </p>
        ) : plan === "free" ? (
          <p className="text-[0.9375rem] text-graphite">
            You are on the Free plan. You can import your list and see who has
            gone quiet, but sending campaigns is a Premium feature. Nothing is
            charged on Free.
          </p>
        ) : (
          <p className="text-[0.9375rem] text-graphite">
            {gym.subscription_status === "past_due"
              ? "Your last payment did not go through. Sending is paused until the card is updated."
              : "Premium is active. Sending is on."}
            {gym.current_period_end ? (
              <>
                {" "}
                Next payment{" "}
                <span className="literal text-ink">
                  {formatDate(gym.current_period_end)}
                </span>
                .
              </>
            ) : null}
          </p>
        )}

        {isPaidPlan(plan) && role === "owner" ? (
          <form action="/api/stripe/portal" method="post" className="mt-5">
            <Button type="submit" variant="quiet">
              Manage billing
            </Button>
            <p className="field-hint">
              Change your card, see invoices, or cancel. Opens Stripe.
            </p>
          </form>
        ) : null}
      </Card>

      {/* The guarantee, once there is anything to say about it. Silent for
          anyone who has never paid: there is nothing to guarantee yet. */}
      {!(guarantee.state === "not_started" && guarantee.reason === "not_premium") ? (
        <Card>
          <CardTitle>The profit-or-nothing guarantee</CardTitle>

          {guarantee.state === "not_started" ? (
            <p className="text-[0.9375rem] text-graphite">
              Your 30-day guarantee starts the moment you launch your first
              campaign. Nothing to do until then.
            </p>
          ) : guarantee.state === "running" ? (
            <>
              <p className="text-[0.9375rem] text-graphite">
                <span className="literal text-ink">
                  {guarantee.daysLeft} {guarantee.daysLeft === 1 ? "day" : "days"}
                </span>{" "}
                left on your guarantee window. So far,{" "}
                {formatMoney(guarantee.revenueRecoveredMinor, guaranteeCurrency)}{" "}
                recovered against{" "}
                {formatMoney(guarantee.paidMinor, guaranteeCurrency)} paid.
              </p>
              <p className="mt-2 text-[0.8125rem] text-stone">
                Window ends{" "}
                <span className="literal">{formatDate(guarantee.window.end)}</span>.
                If it has not paid off by then, you can claim a full refund of
                what you paid during this window.
              </p>
            </>
          ) : guarantee.state === "met" ? (
            <p className="text-[0.9375rem] text-graphite">
              casdey earned its keep:{" "}
              {formatMoney(guarantee.revenueRecoveredMinor, guaranteeCurrency)}{" "}
              recovered against{" "}
              {formatMoney(guarantee.paidMinor, guaranteeCurrency)} paid during
              your guarantee window. Nothing to claim.
            </p>
          ) : guarantee.state === "claimable" ? (
            <>
              <p className="text-[0.9375rem] text-graphite">
                Your guarantee window closed with{" "}
                {formatMoney(guarantee.revenueRecoveredMinor, guaranteeCurrency)}{" "}
                recovered against{" "}
                {formatMoney(guarantee.paidMinor, guaranteeCurrency)} paid. That
                does not clear the bar, so you are owed a full refund of what
                you paid during this window.
              </p>
              <div className="mt-4">
                <GuaranteeClaimForm />
              </div>
            </>
          ) : guarantee.state === "needs_review" ? (
            <p className="text-[0.9375rem] text-graphite">
              Your guarantee window has closed. To check whether you are owed a
              refund we need your typical booking value, which is not set
              yet. Add it under Settings, then get in touch and we will handle
              the refund for you.
            </p>
          ) : guarantee.claim.status === "refunded" ? (
            <p className="text-[0.9375rem] text-graphite">
              Refunded{" "}
              <span className="literal text-ink">
                {formatMoney(guarantee.claim.refunded_minor, guaranteeCurrency)}
              </span>{" "}
              on{" "}
              <span className="literal">
                {formatDate(guarantee.claim.created_at)}
              </span>
              .
            </p>
          ) : (
            <p className="text-[0.9375rem] text-graphite">
              You claimed your refund on{" "}
              <span className="literal">
                {formatDate(guarantee.claim.created_at)}
              </span>
              . It has not gone through yet; we have been told and are sorting
              it out directly.
            </p>
          )}

          {guaranteeLedger.length > 0 ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-[0.8125rem] text-stone underline underline-offset-4">
                How we calculated this
              </summary>
              <ul className="mt-3 space-y-2 border-t border-ash/55 pt-3">
                {guaranteeLedger.map((row) => (
                  <li
                    key={row.memberId}
                    className="flex flex-wrap items-baseline justify-between gap-2 text-[0.8125rem]"
                  >
                    <span className="text-graphite">
                      {row.memberName} returned{" "}
                      <span className="literal text-stone">
                        {formatDate(row.returnedAt)}
                      </span>
                    </span>
                    <span className="literal text-ink">
                      +{formatMoney(row.valueMinor, guaranteeCurrency)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[0.75rem] text-stone">
                Each return counts at your typical booking value of{" "}
                {formatMoney(
                  guaranteeLedger[guaranteeLedger.length - 1].valueMinor,
                  guaranteeCurrency,
                )}{" "}
                (Settings). Running total{" "}
                {formatMoney(
                  guaranteeLedger[guaranteeLedger.length - 1]
                    .runningTotalMinor,
                  guaranteeCurrency,
                )}
                .
              </p>
            </details>
          ) : null}
        </Card>
      ) : null}

      {/* Upgrade path, shown to anyone not already on a paid tier.
          TODO (Track F, F3): this section still speaks of a single "Premium"
          plan and lists the old 4 prices via plansFor(). It becomes a
          Standard/Pro chooser once F0's numbers and F2's Stripe prices land. */}
      {!isPaidPlan(plan) ? (
        <div>
          <h2 className="display mb-1 text-[1.25rem]">
            {plan === "trial" ? "Stay on a paid plan" : "Upgrade"}
          </h2>
          <p className="mb-4 text-[0.9375rem] text-graphite">
            A paid plan is where casdey actually sends: it works the quiet half
            of your list for you, start to finish. Billed in{" "}
            {currency === "gbp" ? "pounds" : "euros"}.
          </p>

          {discounted ? (
            <div className="mb-4">
              <Notice>
                As an early adopter you keep{" "}
                <span className="literal">
                  {currency === "gbp" ? "£50" : "€59"}
                </span>{" "}
                a month off, for as long as you stay subscribed.
              </Notice>
            </div>
          ) : null}

          {role !== "owner" ? (
            <Notice tone="warn">
              Only the gym owner can set up billing.
            </Notice>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {plans.map((p) => (
                <form
                  key={p.envVar}
                  action="/api/stripe/checkout"
                  method="post"
                  className="card flex flex-col p-6"
                >
                  <input type="hidden" name="interval" value={p.interval} />
                  <p className="label text-stone">
                    {p.interval === "year" ? "Annual" : "Monthly"}
                  </p>
                  <p className="literal mt-2 text-[2rem] leading-none font-medium text-ink">
                    {p.monthlyDisplay}
                    <span className="text-[0.875rem] font-normal text-stone">
                      {" "}
                      /mo
                    </span>
                  </p>
                  <p className="mt-2 mb-5 flex-1 text-[0.875rem] text-stone">
                    {discounted
                      ? `Before your ${currency === "gbp" ? "£50" : "€59"} discount.`
                      : p.interval === "year"
                        ? `Paid once a year, ${p.chargeDisplay}.`
                        : "Paid monthly, cancel any time."}
                  </p>
                  <Button
                    type="submit"
                    variant={p.interval === "year" ? "quiet" : "primary"}
                  >
                    Go Premium
                  </Button>
                </form>
              ))}
            </div>
          )}

          <p className="mt-4 text-[0.875rem] text-stone">
            If casdey does not recover more than it costs, you do not pay. Tell
            us and we refund you.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function PlanPill({ plan }: { plan: string }) {
  // plan is planLabel(effectivePlan(...)): "Free week" | "Standard" | "Pro" | "Free".
  if (plan === "Standard" || plan === "Pro" || plan === "Free week") {
    return <Pill tone="teal">{plan}</Pill>;
  }
  return <Pill>Free</Pill>;
}
