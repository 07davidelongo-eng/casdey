"use client";

import { useActionState, useId, useState } from "react";

import { Button } from "@/components/app/ui";
import { formatMoney } from "@/lib/money";
import type { Currency } from "@/lib/countries";
import { bookSlotAction, type BookState } from "./actions";

export type SlotOption = { iso: string; timeLabel: string };
export type DayGroup = { key: string; label: string; slots: SlotOption[] };
export type ServiceOption = {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  /** "a month", or empty for a one-off. */
  periodSuffix: string;
  minutes: number;
  /** Places left at each start time, keyed by the slot iso. Absent for a
   *  one-at-a-time service, where a shown slot is simply free. */
  placesLeft: Record<string, number> | null;
};

const INITIAL: BookState = { booked: false, error: null, confirmedStartAt: null };

export function BookingForm({
  token,
  daysByService,
  services,
  currency,
  timezone,
}: {
  token: string;
  /** Open times per service id, because a 60-minute class and a 30-minute
   *  session do not have the same ones. The "" key is the generic list for a
   *  gym with nothing marked bookable. */
  daysByService: Record<string, DayGroup[]>;
  services: ServiceOption[];
  currency: Currency;
  /** The gym's own timezone. The confirmation must show the time the
   *  member actually picked in the gym's clock, not the browser's own,
   *  which can silently disagree with it by an hour or more. */
  timezone: string;
}) {
  const id = useId();
  const [state, action, pending] = useActionState(bookSlotAction, INITIAL);
  const [selectedService, setSelectedService] = useState<string>(
    services[0]?.id ?? "",
  );
  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  const service = services.find((s) => s.id === selectedService) ?? null;
  const days = daysByService[selectedService] ?? [];

  if (state.booked) {
    return (
      <div className="notice notice-info">
        <p className="font-semibold text-ink">You&apos;re booked in.</p>
        <p className="mt-2">
          {state.confirmedStartAt
            ? formatConfirmed(state.confirmedStartAt, timezone)
            : "Your time is confirmed."}{" "}
          {state.emailed
            ? "A confirmation with a calendar invite is on its way to your inbox."
            : null}
        </p>
        {/* The way out, on the screen itself. Promising it by email and
            nothing else strands any member casdey has no address for, and
            anyone whose confirmation does not arrive. */}
        {state.manageUrl ? (
          <p className="mt-2">
            Need to cancel?{" "}
            <a href={state.manageUrl} className="underline">
              Manage this booking
            </a>
            . Keep the link, it stays valid.
          </p>
        ) : null}
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
            What would you like to book?
          </label>
          <select
            id={`${id}-service`}
            name="serviceId"
            value={selectedService}
            onChange={(e) => {
              // The times belong to the service, so a change invalidates
              // whatever was picked under the old one.
              setSelectedService(e.target.value);
              setSelectedIso(null);
            }}
            disabled={pending}
            className="field"
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {formatMoney(s.priceMinor, currency)}
                {s.periodSuffix ? ` ${s.periodSuffix}` : ""}
              </option>
            ))}
          </select>
          {service ? (
            <p className="field-hint">
              {service.description ? `${service.description}. ` : ""}
              {service.minutes} minutes.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-5">
        {days.map((day) => (
          <div key={day.key}>
            <p className="field-label mb-2">{day.label}</p>
            <div className="flex flex-wrap gap-2">
              {day.slots.map((slot) => {
                const active = slot.iso === selectedIso;
                const left = service?.placesLeft?.[slot.iso];
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
                    {left !== undefined ? (
                      <span
                        className={
                          "ml-2 font-normal " +
                          (active ? "text-white/80" : "text-stone")
                        }
                      >
                        {left} left
                      </span>
                    ) : null}
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
