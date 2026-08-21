"use client";

import { useActionState } from "react";

import { Button, Card, CardTitle } from "@/components/app/ui";
import type { Gym, Weekday } from "@/lib/types";
import { saveBookingSettingsAction, type BookingSettingsState } from "./actions";

const INITIAL: BookingSettingsState = { error: null, saved: false };

const DAYS: { key: Weekday; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export function BookingSettingsForm({
  gym,
  readOnly,
}: {
  gym: Gym;
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveBookingSettingsAction,
    INITIAL,
  );
  const disabled = readOnly || pending;

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardTitle>Self-serve booking</CardTitle>
        <p className="mb-5 text-[0.875rem] text-stone">
          When this is on, casdey adds a booking link to your messages. A member
          picks a time from your open hours and it is booked straight away: into
          casdey, and into your Google Calendar if you have connected one above.
        </p>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={gym.booking_enabled}
            disabled={disabled}
            className="mt-1 h-4 w-4 rounded border-ash text-teal focus:ring-teal"
          />
          <span>
            <span className="block text-[0.9375rem] font-semibold text-ink">
              Let members book themselves
            </span>
            <span className="field-hint block">
              Off by default. Turn it on once your hours below are set.
            </span>
          </span>
        </label>
      </Card>

      <Card>
        <CardTitle>Your open hours</CardTitle>
        <p className="mb-5 text-[0.875rem] text-stone">
          The times members can pick from, in your local timezone
          (<span className="literal">{gym.timezone}</span>). Tick a day to
          open it.
        </p>

        <div className="space-y-3">
          {DAYS.map(({ key, label }) => {
            const window = gym.booking_hours[key]?.[0];
            return (
              <div key={key} className="flex flex-wrap items-center gap-3">
                <label className="flex w-32 items-center gap-2">
                  <input
                    type="checkbox"
                    name={`${key}_open`}
                    defaultChecked={Boolean(window)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-ash text-teal focus:ring-teal"
                  />
                  <span className="text-[0.9375rem] text-ink">{label}</span>
                </label>
                <input
                  type="time"
                  name={`${key}_start`}
                  defaultValue={window?.[0] ?? "09:00"}
                  disabled={disabled}
                  className="field literal w-32"
                  aria-label={`${label} opens`}
                />
                <span className="text-stone">to</span>
                <input
                  type="time"
                  name={`${key}_end`}
                  defaultValue={window?.[1] ?? "17:00"}
                  disabled={disabled}
                  className="field literal w-32"
                  aria-label={`${label} closes`}
                />
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>Slot shape</CardTitle>
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField
            name="slotMinutes"
            label="Booking length (minutes)"
            defaultValue={gym.booking_slot_minutes}
            min={5}
            max={480}
            disabled={disabled}
          />
          <NumberField
            name="bufferMinutes"
            label="Gap between bookings (minutes)"
            defaultValue={gym.booking_buffer_minutes}
            min={0}
            max={240}
            disabled={disabled}
          />
          <NumberField
            name="minNoticeHours"
            label="Least notice before a slot (hours)"
            defaultValue={gym.booking_min_notice_hours}
            min={0}
            max={720}
            disabled={disabled}
          />
          <NumberField
            name="horizonDays"
            label="How far ahead to offer (days)"
            defaultValue={gym.booking_horizon_days}
            min={1}
            max={120}
            disabled={disabled}
          />
        </div>
      </Card>

      {state.error ? (
        <p role="alert" className="notice notice-error">
          {state.error}
        </p>
      ) : null}

      {state.saved && !state.error ? (
        <p role="status" className="notice notice-info">
          Saved.
        </p>
      ) : null}

      {!readOnly ? (
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : "Save changes"}
        </Button>
      ) : null}
    </form>
  );
}

function NumberField({
  name,
  label,
  defaultValue,
  min,
  max,
  disabled,
}: {
  name: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
  disabled: boolean;
}) {
  return (
    <div>
      <label htmlFor={`booking-${name}`} className="field-label">
        {label}
      </label>
      <input
        id={`booking-${name}`}
        name={name}
        type="number"
        defaultValue={defaultValue}
        min={min}
        max={max}
        disabled={disabled}
        className="field literal w-32"
      />
    </div>
  );
}
