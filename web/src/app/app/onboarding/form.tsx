"use client";

import { useActionState, useId, useState } from "react";

import { Button } from "@/components/app/ui";
import { COUNTRIES } from "@/lib/countries";
import { createGymAction, type OnboardingState } from "./actions";

const INITIAL: OnboardingState = { error: null };

export function OnboardingForm({ defaultEmail }: { defaultEmail: string }) {
  const id = useId();
  const [state, action, pending] = useActionState(
    createGymAction,
    INITIAL,
  );

  // The reply-to defaults to the account email but is genuinely a different
  // thing: it is where a member's "yes, book me in" lands, so it needs to be
  // an inbox somebody at the gym actually watches.
  const [contactEmail, setContactEmail] = useState(defaultEmail);
  const [replyTouched, setReplyTouched] = useState(false);
  const [replyToEmail, setReplyToEmail] = useState(defaultEmail);

  return (
    <form action={action} className="card p-7">
      <div className="mb-5">
        <label htmlFor={`${id}-name`} className="field-label">
          Gym name
        </label>
        <input
          id={`${id}-name`}
          name="name"
          required
          maxLength={200}
          disabled={pending}
          className="field"
          placeholder="Iron Works Gym"
        />
        <p className="field-hint">
          Members see this as the sender name on every message.
        </p>
      </div>

      <div className="mb-5">
        <label htmlFor={`${id}-country`} className="field-label">
          Country
        </label>
        <select
          id={`${id}-country`}
          name="country"
          required
          defaultValue="GB"
          disabled={pending}
          className="field"
        >
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
        <p className="field-hint">
          Sets your billing currency and the time messages go out.
        </p>
      </div>

      <div className="mb-5">
        <label htmlFor={`${id}-contact`} className="field-label">
          Account email
        </label>
        <input
          id={`${id}-contact`}
          name="contactEmail"
          type="email"
          required
          maxLength={320}
          disabled={pending}
          className="field"
          value={contactEmail}
          onChange={(event) => {
            setContactEmail(event.target.value);
            if (!replyTouched) setReplyToEmail(event.target.value);
          }}
        />
        <p className="field-hint">Billing and account notices come here.</p>
      </div>

      <div className="mb-6">
        <label htmlFor={`${id}-reply`} className="field-label">
          Where member replies go
        </label>
        <input
          id={`${id}-reply`}
          name="replyToEmail"
          type="email"
          required
          maxLength={320}
          disabled={pending}
          className="field"
          value={replyToEmail}
          onChange={(event) => {
            setReplyTouched(true);
            setReplyToEmail(event.target.value);
          }}
        />
        <p className="field-hint">
          When a member replies to book, it lands in this inbox. Usually your
          reception address.
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="notice notice-error mb-5">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Setting up" : "Continue"}
      </Button>
    </form>
  );
}
