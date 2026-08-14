"use client";

import { useState, useTransition } from "react";

import { Button, Card, CardTitle } from "@/components/app/ui";
import { currencySymbol } from "@/lib/money";
import type { Currency } from "@/lib/countries";
import type { PracticeService } from "@/lib/types";
import { saveServices, type ServicesState } from "./actions";

type Row = { key: string; id: string | null; name: string; price: string };

function toRow(service: PracticeService): Row {
  return {
    key: service.id,
    id: service.id,
    name: service.name,
    price: String(service.price_minor / 100),
  };
}

function blankRow(): Row {
  return {
    key: `new-${Math.random().toString(36).slice(2)}`,
    id: null,
    name: "",
    price: "",
  };
}

export function ServicesForm({
  services,
  currency,
  readOnly,
}: {
  services: PracticeService[];
  currency: Currency;
  readOnly: boolean;
}) {
  const symbol = currencySymbol(currency);
  const [rows, setRows] = useState<Row[]>(
    services.length > 0 ? services.map(toRow) : [blankRow()],
  );
  const [state, setState] = useState<ServicesState>({ error: null, saved: false });
  const [pending, startTransition] = useTransition();
  const disabled = readOnly || pending;

  function update(key: string, field: "name" | "price", value: string) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
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
    // A row with neither a name nor a price is just an empty line the practice
    // left behind. Drop it rather than making them tidy up before saving.
    const kept = rows.filter((row) => row.name.trim() !== "" || row.price.trim() !== "");

    const payload = kept.map((row) => ({
      id: row.id,
      name: row.name.trim(),
      price: Number(row.price),
    }));

    startTransition(async () => {
      const result = await saveServices(payload);
      setState(result);
      if (!result.error) {
        // Empty trailing rows are gone; keep at least one line to type into.
        setRows(kept.length > 0 ? kept : [blankRow()]);
      }
    });
  }

  return (
    <Card>
      <CardTitle>Your service prices</CardTitle>
      <p className="mb-5 text-[0.875rem] text-stone">
        The treatments you offer and what they cost. casdey uses these to show
        patients what a visit is worth in a message, and to value the work it
        books back in. Add as many as you like.
      </p>

      <div className="space-y-3">
        <div className="flex gap-3 pr-9">
          <span className="field-label flex-1">Service</span>
          <span className="field-label w-32">Price</span>
        </div>

        {rows.map((row) => (
          <div key={row.key} className="flex items-start gap-3">
            <input
              aria-label="Service name"
              value={row.name}
              onChange={(e) => update(row.key, "name", e.target.value)}
              placeholder="Check-up"
              maxLength={120}
              disabled={disabled}
              className="field flex-1"
            />
            <div className="flex w-32 items-center gap-2">
              <span className="literal text-graphite">{symbol}</span>
              <input
                aria-label="Price"
                type="number"
                min={0}
                max={1000000}
                step="0.01"
                inputMode="decimal"
                value={row.price}
                onChange={(e) => update(row.key, "price", e.target.value)}
                placeholder="60"
                disabled={disabled}
                className="field literal"
              />
            </div>
            <button
              type="button"
              onClick={() => remove(row.key)}
              disabled={disabled}
              aria-label={`Remove ${row.name || "service"}`}
              className="mt-2 shrink-0 text-stone transition-colors duration-200 hover:text-ink disabled:opacity-40"
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
        ))}
      </div>

      {!readOnly ? (
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="mt-4 text-[0.9375rem] font-semibold text-teal hover:text-teal-hover disabled:opacity-55"
        >
          + Add a service
        </button>
      ) : null}

      {state.error ? (
        <p role="alert" className="notice notice-error mt-5">
          {state.error}
        </p>
      ) : null}

      {state.saved && !state.error ? (
        <p role="status" className="notice notice-info mt-5">
          Saved.
        </p>
      ) : null}

      {!readOnly ? (
        <div className="mt-6">
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Saving" : "Save prices"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
