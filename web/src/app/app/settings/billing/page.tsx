import { requirePractice } from "@/lib/dal";
import { currencyFor } from "@/lib/countries";
import { TRIAL_DAYS, isStripeConfigured, plansFor } from "@/lib/stripe";
import {
  Button,
  Card,
  CardTitle,
  Notice,
  Pill,
  formatDate,
} from "@/components/app/ui";

export const metadata = { title: "Billing" };

export default async function BillingPage(
  props: PageProps<"/app/settings/billing">,
) {
  const params = await props.searchParams;
  const { practice, role } = await requirePractice();

  const status = practice.subscription_status;
  const currency = currencyFor(practice.country);
  const plans = plansFor(currency);
  const subscribed = status !== "none" && status !== "canceled";

  const errorMessage =
    typeof params.error === "string" ? params.error : null;

  return (
    <div className="max-w-[42rem] space-y-6">
      {params.welcome ? (
        <Notice>
          Practice created. One step left: add a card to start your free week.
          Nothing is charged for {TRIAL_DAYS} days.
        </Notice>
      ) : null}

      {params.cancelled ? (
        <Notice>
          Payment was not set up, so nothing has changed. You can start the free
          week whenever you are ready.
        </Notice>
      ) : null}

      {params.expired ? (
        <Notice tone="warn">
          That part of casdey needs an active account. Your data is untouched.
        </Notice>
      ) : null}

      {errorMessage ? <Notice tone="error">{errorMessage}</Notice> : null}

      {!isStripeConfigured() ? (
        <Notice tone="error">
          Stripe is not configured on this environment, so checkout will not
          open. Set STRIPE_SECRET_KEY and the four price ids in the environment.
        </Notice>
      ) : null}

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <CardTitle>Your plan</CardTitle>
          <StatusPill status={status} />
        </div>

        {status === "trialing" ? (
          <p className="text-[0.9375rem] text-graphite">
            Your free week runs until{" "}
            <span className="literal text-ink">
              {formatDate(practice.trial_ends_at)}
            </span>
            . After that your card is charged automatically. Cancel before then
            and you pay nothing.
          </p>
        ) : null}

        {status === "active" ? (
          <p className="text-[0.9375rem] text-graphite">
            Next payment{" "}
            <span className="literal text-ink">
              {formatDate(practice.current_period_end)}
            </span>
            .
          </p>
        ) : null}

        {status === "past_due" ? (
          <p className="text-[0.9375rem] text-graphite">
            The last payment did not go through. Sending is paused until the
            card is updated. Nothing has been deleted.
          </p>
        ) : null}

        {status === "none" ? (
          <p className="text-[0.9375rem] text-graphite">
            No card on file yet. The first {TRIAL_DAYS} days are free, and you
            can cancel inside that week without paying.
          </p>
        ) : null}

        {status === "canceled" ? (
          <p className="text-[0.9375rem] text-graphite">
            This account is not active. Your patients and campaigns are still
            here, sending is off.
          </p>
        ) : null}

        {subscribed && role === "owner" ? (
          <form action="/api/stripe/portal" method="post" className="mt-5">
            <Button type="submit" variant="quiet">
              Manage billing
            </Button>
            <p className="field-hint">
              Change your card, download invoices, or cancel. Opens Stripe.
            </p>
          </form>
        ) : null}
      </Card>

      {!subscribed ? (
        <div>
          <h2 className="display mb-1 text-[1.25rem]">
            Start your free week
          </h2>
          <p className="mb-4 text-[0.9375rem] text-graphite">
            Billed in {currency === "gbp" ? "pounds" : "euros"}, because your
            practice is registered in{" "}
            {currency === "gbp" ? "the UK" : "the EU"}. Nothing is charged for{" "}
            {TRIAL_DAYS} days.
          </p>

          {role !== "owner" ? (
            <Notice tone="warn">
              Only the practice owner can set up billing.
            </Notice>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {plans.map((plan) => (
                <form
                  key={plan.envVar}
                  action="/api/stripe/checkout"
                  method="post"
                  className="card flex flex-col p-6"
                >
                  <input
                    type="hidden"
                    name="interval"
                    value={plan.interval}
                  />
                  <p className="label text-stone">
                    {plan.interval === "year" ? "Annual" : "Monthly"}
                  </p>
                  <p className="literal mt-2 text-[2rem] leading-none font-medium text-ink">
                    {plan.monthlyDisplay}
                    <span className="text-[0.875rem] font-normal text-stone">
                      {" "}
                      /mo
                    </span>
                  </p>
                  <p className="mt-2 mb-5 flex-1 text-[0.875rem] text-stone">
                    {plan.interval === "year"
                      ? `Paid once a year, ${plan.chargeDisplay}.`
                      : "Paid monthly, cancel any time."}
                  </p>
                  <Button
                    type="submit"
                    variant={plan.interval === "year" ? "quiet" : "primary"}
                  >
                    Start free week
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

function StatusPill({ status }: { status: string }) {
  if (status === "active") return <Pill tone="teal">Active</Pill>;
  if (status === "trialing") return <Pill tone="teal">Free week</Pill>;
  if (status === "past_due") return <Pill>Payment failed</Pill>;
  if (status === "canceled") return <Pill>Cancelled</Pill>;
  return <Pill>Not started</Pill>;
}
