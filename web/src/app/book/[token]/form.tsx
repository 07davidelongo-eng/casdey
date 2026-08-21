"use client";

import { useActionState, useId, useState } from "react";

import { Button } from "@/components/app/ui";
import { formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/countries";
import { bookSlotAction, type BookState } from "./actions";

export type SlotOption = { iso: string; timeLabel: string };
export type DayGroup = { key: string; label: string; slots: SlotOption[] };
export type ServiceOption = { id: string; name: string; priceMinor: number };

const INITIAL: BookState = { booked: false, error: null, confirmedStartAt: null };

export function BookingForm({
  token,
  days,
  services,
  currency,
  timezone,
}: {
  token: string;
  days: DayGroup[];
  services: ServiceOption[];
  currency: Currency;
  /** The gym's own timezone. The confirmation must show the time the
   *  member actually picked in the gym's clock, not the browser's own,
   *  which can silently disagree with it by an hour or more. */
  timezone: string;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(bookSlotAction, INITIAL);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string>("");

  if (state.booked) {
    return (
      <div className="notice notice-info">
        <p className="font-semibold text-ink">You&apos;re booked in.</p>
        <p className="mt-2">
          {state.confirmedStartAt
            ? formatConfirmed(state.confirmedStartAt, timezone)
            : "Check your email for the details."}{" "}
          A confirmation with a calendar invite is on its way to your inbox.
        </p>
      </div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="startAt" value={selectedIso ?? ""} />

      {services.length > 0 ? (
        <div className="mb-6">
          <label htmlFor={`${id}-service`} className="field-label">
            What&apos;s this for? (optional)
          </label>
          <select
            id={`${id}-service`}
            name="serviceId"
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            disabled={pending}
            className="field"
          >
            <option value="">No preference</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {formatMoney(s.priceMinor, currency)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-5">
        {days.map((day) => (
          <div key={day.key}>
            <p className="field-label mb-2">{day.label}</p>
            <div className="flex flex-wrap gap-2">
              {day.slots.map((slot) => {
                const active = slot.iso === selectedIso;
                return (
                  <button
                    key={slot.iso}
                    type="button"
                    disabled={pending}
                    onClick={() => setSelectedIso(slot.iso)}
                    aria-pressed={active}
                    className={`rounded-[10px] border px-3.5 py-2 text-[0.875rem] font-semibold transition-colors duration-200 ${
                      active
                        ? "border-teal bg-teal text-white"
                        : "border-ash bg-white text-ink hover:border-stone"
                    }`}
                  >
                    {slot.timeLabel}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {state.error ? (
        <p role="alert" className="notice notice-error mt-5">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || !selectedIso} className="mt-6 w-full">
        {pending ? "Booking" : "Confirm this time"}
      </Button>
    </form>
  );
}

function formatConfirmed(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
