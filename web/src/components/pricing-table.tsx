"use client";

import { useState } from "react";

import {
  FEATURE_ROWS,
  TIER_LINES,
  TIER_NAMES,
  TIER_ORDER,
  findPricePlan,
  type PlanInterval,
  type PublicTier,
} from "@/lib/pricing";
import type { Currency } from "@/lib/countries";
import { ButtonLink } from "./ui";

/**
 * The pricing page's two interactive parts: the currency and term switches,
 * and the comparison they drive.
 *
 * Prices come from lib/pricing, which is the same catalogue the Stripe
 * checkout charges against, so what is advertised here and what leaves the
 * card cannot drift apart.
 */

function Switch<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-full border border-ash bg-white p-1"
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={on}
            className={
              "rounded-full px-4 py-1.5 text-[0.875rem] transition-colors duration-200 " +
              (on
                ? "bg-ink font-medium text-paper"
                : "text-graphite hover:text-ink")
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Mark({ on }: { on: boolean }) {
  return on ? (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 text-teal"
      role="img"
      aria-label="Included"
    >
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <span
      className="block h-px w-3 bg-ash"
      role="img"
      aria-label="Not included"
    />
  );
}

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return <span className="text-[0.9375rem] text-ink">{value}</span>;
  }
  return <Mark on={value} />;
}

export function PricingTable() {
  const [currency, setCurrency] = useState<Currency>("eur");
  const [interval, setInterval] = useState<PlanInterval>("month");

  const priceFor = (tier: PublicTier) => {
    if (tier === "free") {
      return {
        headline: currency === "eur" ? "€0" : "£0",
        sub: "Free forever",
      };
    }
    const plan = findPricePlan(tier, currency, interval);
    if (!plan) return { headline: "—", sub: "" };
    return {
      headline: plan.monthlyDisplay,
      sub:
        interval === "year"
          ? `a month, billed as ${plan.chargeDisplay}`
          : "a month",
    };
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Switch
          label="Billing period"
          value={interval}
          onChange={setInterval}
          options={[
            { value: "month", label: "Monthly" },
            { value: "year", label: "Yearly, 2 months free" },
          ]}
        />
        <Switch
          label="Currency"
          value={currency}
          onChange={setCurrency}
          options={[
            { value: "eur", label: "EUR" },
            { value: "gbp", label: "GBP" },
          ]}
        />
      </div>

      <div className="mt-10 overflow-hidden rounded-[20px] border border-ash bg-white">
        <div className="grid divide-y divide-ash sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {TIER_ORDER.map((tier) => {
            const price = priceFor(tier);
            return (
              <div key={tier} className="flex flex-col p-8 sm:p-9">
                <div className="flex items-center gap-3">
                  <p className="label text-ink">{TIER_NAMES[tier]}</p>
                  {tier === "pro" && (
                    <span className="rounded-full bg-shallow px-2 py-0.5 text-[11px] font-medium text-teal">
                      Most gyms
                    </span>
                  )}
                </div>

                <p className="display mt-5 text-[2.5rem] leading-none text-ink tabular-nums">
                  {price.headline}
                </p>
                <p className="mt-2 min-h-[2.5em] text-[0.8125rem] text-stone">
                  {price.sub}
                </p>

                <p className="mt-4 text-[0.9375rem] leading-relaxed text-graphite">
                  {TIER_LINES[tier]}
                </p>

                <div className="mt-7 pt-1">
                  <ButtonLink
                    href="/login?mode=signup"
                    size="sm"
                    variant={tier === "pro" ? "primary" : "quiet"}
                  >
                    {tier === "free" ? "Start free" : "Start your free week"}
                  </ButtonLink>
                </div>
              </div>
            );
          })}
        </div>

        {/* A four-column comparison cannot be squeezed into 375px without
            reducing every label to one word a line, so below sm it keeps its
            readable widths and scrolls inside its own box instead. */}
        <div className="overflow-x-auto border-t border-ash">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <caption className="sr-only">
              What each casdey plan includes
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="w-[46%] px-5 py-3 text-[0.8125rem] font-medium text-stone sm:px-9"
                >
                  Included
                </th>
                {TIER_ORDER.map((tier) => (
                  <th
                    key={tier}
                    scope="col"
                    className="w-[18%] px-3 py-3 text-[0.8125rem] font-medium text-stone"
                  >
                    {TIER_NAMES[tier]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row) => (
                <tr key={row.label} className="border-t border-ash">
                  <th
                    scope="row"
                    className="w-[46%] px-5 py-4 text-left text-[0.9375rem] font-normal text-ink sm:px-9"
                  >
                    {row.label}
                    {row.note && (
                      <span className="mt-1 block text-[0.8125rem] text-stone">
                        {row.note}
                      </span>
                    )}
                  </th>
                  <td className="px-3 py-4 align-top">
                    <Cell value={row.free} />
                  </td>
                  <td className="px-3 py-4 align-top">
                    <Cell value={row.standard} />
                  </td>
                  <td className="px-3 py-4 align-top">
                    <Cell value={row.pro} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
