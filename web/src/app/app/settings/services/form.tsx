"use client";

import { useState, useTransition } from "react";

import { Button, Card, CardTitle, Pill } from "@/components/app/ui";
import { currencySymbol } from "@/lib/money";
import {
  BILLING_PERIOD_OPTIONS,
  isRecurring,
  periodSuffix,
  type BillingPeriod,
} from "@/lib/services";
import type { Currency } from "@/lib/countries";
import type { Service } from "@/lib/types";
import { saveServices, type ServicesState } from "./actions";

/**
 * What the gym sells, not what it charges.
 *
 * This was a two-column price list: a name and a number. That was enough when
 * the only job was naming a figure in a message, and it stopped being enough
 * the moment booking arrived, because the shape of a booking is a property of
 * the thing being booked. A 60-minute yoga class for twenty and a 30-minute PT
 * session for one are not the same slot, and the gym had one setting for both.
 *
 * Each service is a card rather than a table row. A row forces every field to
 * be narrow enough to sit beside the others, and half of these only matter for
 * the services that are bookable, so they open when that switch goes on and
 * stay out of the way otherwise.
 */

type Row = {
  key: string;
  id: string | null;
  name: string;
  description: string;
  price: string;
  billingPeriod: BillingPeriod;
  active: boolean;
  bookable: boolean;
  duration: string;
  buffer: string;
  capacity: string;
};

function toRow(service: Service): Row {
  return {
    key: service.id,
    id: service.id,
    name: service.name,
    description: service.description ?? "",
    price: String(service.price_minor / 100),
    billingPeriod: service.billing_period,
    active: service.active,
    bookable: service.bookable,
    duration: service.duration_minutes == null ? "" : String(service.duration_minutes),
    buffer: service.buffer_minutes == null ? "" : String(service.buffer_minutes),
    capacity: String(service.capacity),
  };
}

function blankRow(): Row {
  return {
    key: `new-${Math.random().toString(36).slice(2)}`,
    id: null,
    name: "",
    description: "",
    price: "",
    billingPeriod: "monthly",
    active: true,
    bookable: false,
    duration: "",
    buffer: "",
    capacity: "1",
  };
}

export function ServicesForm({
  services,
  currency,
  readOnly,
  gymDefaults,
}: {
  services: Service[];
  currency: Currency;
  readOnly: boolean;
  gymDefaults: { slotMinutes: number; bufferMinutes: number };
}) {
  const symbol = currencySymbol(currency);
  const [rows, setRows] = useState<Row[]>(
    services.length > 0 ? services.map(toRow) : [blankRow()],
  );
  const [state, setState] = useState<ServicesState>({
    error: null,
    saved: false,
  });
  const [pending, startTransition] = useTransition();
  const disabled = readOnly || pending;

  function update(key: string, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
    setState({ error: null, saved: false });
  }

  function remove(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
    setState({ error: null, saved: false });
  }

  function add() {
    setRows((current) => [...current, blankRow()]);
    setState({ error: null, saved: false });
  }

  function save() {
    // A row with neither a name nor a price is just an empty line the gym
    // left behind. Drop it rather than making them tidy up before saving.
    const kept = rows.filter(
      (row) => row.name.trim() !== "" || row.price.trim() !== "",
    );

    const payload = kept.map((row) => ({
      id: row.id,
      name: row.name.trim(),
      description: row.description.trim(),
      price: Number(row.price),
      billingPeriod: row.billingPeriod,
      active: row.active,
      bookable: row.bookable,
      durationMinutes: row.duration.trim() === "" ? null : Number(row.duration),
      bufferMinutes: row.buffer.trim() === "" ? null : Number(row.buffer),
      capacity: Number(row.capacity || 1),
    }));

    startTransition(async () => {
      const result = await saveServices(payload);
      setState(result);
      if (!result.error) setRows(kept.length > 0 ? kept : [blankRow()]);
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle>What you sell</CardTitle>
        <p className="text-[0.875rem] leading-relaxed text-stone">
          Every membership, class, pack and session you offer. casdey values
          your quiet list against these, names them in messages, and books
          members into the ones you mark bookable. Adding one costs nothing and
          you can retire it later without losing its history.
        </p>
      </Card>

      {rows.map((row, index) => {
        const recurring = isRecurring(row.billingPeriod);
        return (
          <Card key={row.key}>
            <div className="mb-4 flex items-start gap-3">
              <div className="flex-1">
                <label className="field-label" htmlFor={`${row.key}-name`}>
                  Name
                </label>
                <input
                  id={`${row.key}-name`}
                  value={row.name}
                  onChange={(e) => update(row.key, { name: e.target.value })}
                  placeholder="Monthly membership"
                  maxLength={120}
                  disabled={disabled}
                  className="field"
                />
              </div>
              <button
                type="button"
                onClick={() => remove(row.key)}
                disabled={disabled}
                aria-label={`Remove ${row.name || `service ${index + 1}`}`}
                className="mt-7 shrink-0 text-stone transition-colors duration-200 hover:text-ink disabled:opacity-40"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M6 6l8 8M14 6l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <label className="field-label" htmlFor={`${row.key}-desc`}>
                What it is <span className="text-stone">(optional)</span>
              </label>
              <input
                id={`${row.key}-desc`}
                value={row.description}
                onChange={(e) =>
                  update(row.key, { description: e.target.value })
                }
                placeholder="Full access, all classes included"
                maxLength={300}
                disabled={disabled}
                className="field"
              />
              <p className="field-hint">
                A member sees this when picking a time to book.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor={`${row.key}-price`}>
                  Price
                </label>
                <div className="flex items-center gap-2">
                  <span className="literal text-graphite">{symbol}</span>
                  <input
                    id={`${row.key}-price`}
                    type="number"
                    min={0}
                    max={1000000}
                    step="0.01"
                    inputMode="decimal"
                    value={row.price}
                    onChange={(e) => update(row.key, { price: e.target.value })}
                    placeholder="89"
                    disabled={disabled}
                    className="field literal"
                  />
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor={`${row.key}-period`}>
                  Charged
                </label>
                <select
                  id={`${row.key}-period`}
                  value={row.billingPeriod}
                  onChange={(e) =>
                    update(row.key, {
                      billingPeriod: e.target.value as BillingPeriod,
                    })
                  }
                  disabled={disabled}
                  className="field"
                >
                  {BILLING_PERIOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="field-hint">
                  {recurring
                    ? `Reads as ${symbol}${row.price || "0"} ${periodSuffix(row.billingPeriod)}, and counts as recurring revenue.`
                    : "A pack or a single session. Charged once."}
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-ash pt-5">
              <label className="flex items-center gap-2.5 text-[0.9375rem] text-ink">
                <input
                  type="checkbox"
                  checked={row.bookable}
                  onChange={(e) =>
                    update(row.key, { bookable: e.target.checked })
                  }
                  disabled={disabled}
                  className="h-4 w-4 accent-[var(--teal)]"
                />
                Members can book this
              </label>

              {row.bookable ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <label
                      className="field-label"
                      htmlFor={`${row.key}-duration`}
                    >
                      Runs for
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id={`${row.key}-duration`}
                        type="number"
                        min={5}
                        max={480}
                        step={5}
                        value={row.duration}
                        onChange={(e) =>
                          update(row.key, { duration: e.target.value })
                        }
                        placeholder={String(gymDefaults.slotMinutes)}
                        disabled={disabled}
                        className="field literal"
                      />
                      <span className="text-[0.9375rem] text-graphite">min</span>
                    </div>
                    <p className="field-hint">
                      Blank uses your {gymDefaults.slotMinutes} minute default.
                    </p>
                  </div>

                  <div>
                    <label className="field-label" htmlFor={`${row.key}-buffer`}>
                      Gap after
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id={`${row.key}-buffer`}
                        type="number"
                        min={0}
                        max={240}
                        step={5}
                        value={row.buffer}
                        onChange={(e) =>
                          update(row.key, { buffer: e.target.value })
                        }
                        placeholder={String(gymDefaults.bufferMinutes)}
                        disabled={disabled}
                        className="field literal"
                      />
                      <span className="text-[0.9375rem] text-graphite">min</span>
                    </div>
                    <p className="field-hint">
                      Cleaning down, resetting the room.
                    </p>
                  </div>

                  <div>
                    <label
                      className="field-label"
                      htmlFor={`${row.key}-capacity`}
                    >
                      Places
                    </label>
                    <input
                      id={`${row.key}-capacity`}
                      type="number"
                      min={1}
                      max={500}
                      step={1}
                      value={row.capacity}
                      onChange={(e) =>
                        update(row.key, { capacity: e.target.value })
                      }
                      disabled={disabled}
                      className="field literal"
                    />
                    <p className="field-hint">
                      {Number(row.capacity) > 1
                        ? "A class. Members share the slot and it fills up."
                        : "One at a time. Blocks your whole diary for its length."}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-ash pt-4">
              <label className="flex items-center gap-2.5 text-[0.9375rem] text-ink">
                <input
                  type="checkbox"
                  checked={row.active}
                  onChange={(e) => update(row.key, { active: e.target.checked })}
                  disabled={disabled}
                  className="h-4 w-4 accent-[var(--teal)]"
                />
                Still selling this
              </label>
              {!row.active ? (
                <Pill>Retired, kept for past bookings</Pill>
              ) : null}
            </div>
          </Card>
        );
      })}

      {!readOnly ? (
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="text-[0.9375rem] font-semibold text-teal hover:text-teal-hover disabled:opacity-55"
        >
          + Add a service
        </button>
      ) : null}

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
        <div>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Saving" : "Save services"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
