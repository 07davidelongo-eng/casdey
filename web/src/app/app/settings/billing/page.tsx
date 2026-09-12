import { requireGym } from "@/lib/dal";
import { currencyFor } from "@/lib/countries";
import {
  capabilities,
  earlyAdopterProgramActive,
  effectivePlan,
  isPaidPlan,
  planLabel,
  trialDaysLeft,
} from "@/lib/plan";
import type { PlanTier } from "@/lib/types";
import { isStripeConfigured, pricePlansFor } from "@/lib/stripe";
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
import { IconShield } from "@/components/marks/icons";
import { GuaranteeClaimForm } from "./guarantee-claim-form";

export const metadata = { title: "Billing" };

export default async function BillingPage(
  props: PageProps<"/app/settings/billing">,
) {
  const params = await props.searchParams;
  const { gym, role, session } = await requireGym();

  const plan = effectivePlan(gym);
  const caps = capabilities(gym);
  const currency = currencyFor(gym.country);
  const daysLeft = trialDaysLeft(gym);
  const discounted = gym.early_adopter && earlyAdopterProgramActive();

  // What to offer: a Standard gym can still go Pro; everyone else sees both.
  const offerTiers: PlanTier[] =
    plan === "standard" ? ["pro"] : ["standard", "pro"];
  const showUpgrade = !isPaidPlan(plan) || plan === "standard";
  const errorMessage = typeof params.error === "string" ? params.error : null;
  const guarantee = await loadGuaranteeStatus(session.supabase, gym);
  const guaranteeCurrency = gymCurrency(gym);
  const guaranteeLedger = await loadGuaranteeLedgerForStatus(
    session.supabase,
    gym,
    guarantee,
  );

  {/* The guarantee is a Pro feature, and everyone on this page sees it.
          It used to be hidden from anyone who had never paid, on the reasoning
          that there was nothing yet to guarantee. That hid it from precisely
          the gym deciding whether to pay at all, which is the only audience
          the promise is for. */}
  // Rendered under the prices rather than above them: the promise answers
  // the question the prices raise, so it belongs on that side of the number.
  const guaranteeSection = (
    <>
      {!caps.hasGuarantee ? (
        <Card>
          <GuaranteeHeading />
          <p className="text-[0.9375rem] leading-relaxed text-graphite">
            It is on the Pro plan. If casdey does not recover more than it costs
            you over your first 30 days on it, you claim a full refund of what
            you paid in them, from this page, on one click. No form, no review,
            no conversation. It is the one thing here that puts casdey&apos;s
            money where its mouth is.
          </p>
        </Card>
      ) : (
        <Card>
          <GuaranteeHeading />

          {guarantee.state === "not_started" ? (
            <p className="text-[0.9375rem] leading-relaxed text-graphite">
              {guarantee.reason === "not_premium"
                ? "Your 30-day window opens with the first campaign you run after your first Pro payment. Everything is unlocked during the free week, but the guarantee is something casdey owes you once you are paying for it."
                : "Your 30-day guarantee starts the moment you launch your first campaign. Nothing to do until then."}
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
                    key={row.bookingId}
                    className="flex flex-wrap items-baseline justify-between gap-2 text-[0.8125rem]"
                  >
                    <span className="text-graphite">
                      {row.memberName}, {row.serviceName}{" "}
                      <span className="literal text-stone">
                        {formatDate(row.bookedAt)}
                      </span>
                    </span>
                    <span className="literal text-ink">
                      +{formatMoney(row.valueMinor, guaranteeCurrency)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[0.75rem] text-stone">
                Every booking counts at the price of the service it was for,
                taken from Settings → Services at the moment it was booked.
                Total{" "}
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
      )}
    </>
  );

  return (
    <div className="max-w-[44rem] space-y-6">
      {params.welcome ? (
        <Notice>
          You are set up and your free week has started. It is the whole Pro plan,
          unlocked, with no card needed.
        </Notice>
      ) : null}
      {params.upgraded ? (
        <Notice>You&apos;re upgraded. Sending is on.</Notice>
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
            You are on the free week of Pro{" "}
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
            gone quiet, but sending campaigns needs a paid plan. Nothing is
            charged on Free.
          </p>
        ) : (
          <p className="text-[0.9375rem] text-graphite">
            {gym.subscription_status === "incomplete" ? (
              /* Not a refusal. The card works and the bank simply wants the
                 owner to approve the first charge, which European cards ask
                 for routinely. Sending "update your card" here would send a
                 gym hunting for a fault that does not exist. */
              "Your bank needs you to approve the first payment before it goes through. Open the billing portal below to confirm it. Sending is paused until then, and nothing else you have set up is affected."
            ) : gym.subscription_status === "past_due" ? (
              "Your last payment did not go through. Sending is paused until the card is updated."
            ) : gym.cancels_at ? (
              /* Cancelled, but paid up to the end of the period. Saying
                 "next payment" here told a gym that had just cancelled it
                 would be charged again. */
              <>
                {planLabel(plan)} is active until{" "}
                <span className="literal text-ink">
                  {formatDate(gym.cancels_at)}
                </span>
                , then you drop to the Free plan. Sending is on until then, and
                nothing more is charged.
              </>
            ) : (
              <>
                {planLabel(plan)} is active. Sending is on.
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
              </>
            )}
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

      {/* Upgrade path. Trial / Free see Standard + Pro; a Standard gym sees
          Pro only. A paid Pro gym sees nothing here. */}
      {showUpgrade ? (
        <div className="space-y-8">
          <div>
            <h2 className="display mb-1 text-[1.25rem]">
              {plan === "standard"
                ? "Upgrade to Pro"
                : plan === "trial"
                  ? "Choose a plan for after your free week"
                  : "Choose a plan"}
            </h2>
            <p className="text-[0.9375rem] text-graphite">
              A paid plan is where casdey sends: it works the quiet half of your
              list for you, start to finish. Billed in{" "}
              {currency === "gbp" ? "pounds" : "euros"}.
            </p>
          </div>

          {discounted ? (
            <Notice>
              As an early adopter you keep{" "}
              <span className="literal">20% off</span> either paid plan, for as
              long as you stay subscribed.
            </Notice>
          ) : null}

          {role !== "owner" ? (
            <Notice tone="warn">Only the gym owner can set up billing.</Notice>
          ) : (
            offerTiers.map((tier) => (
              <TierBlock
                key={tier}
                tier={tier}
                currency={currency}
                discounted={discounted}
              />
            ))
          )}

          {guaranteeSection}
        </div>
      ) : (
        guaranteeSection
      )}
    </div>
  );
}

const TIER_BLURB: Record<PlanTier, string> = {
  standard:
    "Email win-back and at-risk campaigns, casdey-owned booking, up to 200 members.",
  pro: "Everything in Standard, plus the WhatsApp channel, the profit-or-nothing guarantee, and up to 2,000 members.",
};

function TierBlock({
  tier,
  currency,
  discounted,
}: {
  tier: PlanTier;
  currency: "gbp" | "eur";
  discounted: boolean;
}) {
  const plans = pricePlansFor(tier, currency);
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-[1.0625rem] font-semibold text-ink">
          {tier === "pro" ? "Pro" : "Standard"}
        </h3>
        <span className="text-[0.8125rem] text-stone">{TIER_BLURB[tier]}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((p) => (
          <form
            key={p.envVar}
            action="/api/stripe/checkout"
            method="post"
            className="card flex flex-col p-6"
          >
            <input type="hidden" name="tier" value={p.tier} />
            <input type="hidden" name="interval" value={p.interval} />
            <p className="label text-stone">
              {p.interval === "year" ? "Annual" : "Monthly"}
            </p>
            <p className="literal mt-2 text-[2rem] leading-none font-medium text-ink">
              {p.monthlyDisplay}
              <span className="text-[0.875rem] font-normal text-stone"> /mo</span>
            </p>
            <p className="mt-2 mb-5 flex-1 text-[0.875rem] text-stone">
              {discounted
                ? "Before your 20% early-adopter discount."
                : p.interval === "year"
                  ? `Paid once a year, ${p.chargeDisplay}.`
                  : "Paid monthly, cancel any time."}
            </p>
            <Button
              type="submit"
              variant={p.interval === "year" ? "quiet" : "primary"}
            >
              {p.interval === "year"
                ? `${tier === "pro" ? "Pro" : "Standard"}, annual`
                : `Go ${tier === "pro" ? "Pro" : "Standard"}`}
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
}

function PlanPill({ plan }: { plan: string }) {
  // plan is planLabel(effectivePlan(...)): "Free week of Pro" | "Standard" |
  // "Pro" | "Free".
  if (plan === "Standard" || plan === "Pro" || plan === "Free week of Pro") {
    return <Pill tone="teal">{plan}</Pill>;
  }
  return <Pill>Free</Pill>;
}

/**
 * The guarantee's own heading, rather than another card title in a column of
 * them.
 *
 * It is the only thing on this page a competitor cannot copy without taking
 * the same risk, and it was set in the same type as "Payment method". Weight
 * comes from the mark and the scale, not from a colour the rest of the app
 * does not use.
 */
function GuaranteeHeading() {
  return (
    <div className="mb-4 flex items-start gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-shallow text-teal">
        <IconShield className="h-5 w-5" />
      </span>
      <div>
        <p className="label text-teal">Profit or nothing</p>
        <p className="display mt-1 text-[1.375rem] leading-tight text-ink">
          If it does not make you more than it costs, you do not pay.
        </p>
      </div>
    </div>
  );
}
