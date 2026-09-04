"use client";

import { useActionState, useId } from "react";

import { Button, Card, CardTitle, Notice, Pill } from "@/components/app/ui";
import type { Gym } from "@/lib/types";
import {
  checkDomainAction,
  connectDomainAction,
  disconnectDomainAction,
  type SendingState,
} from "./actions";

const INITIAL: SendingState = { error: null, message: null };

function StatusPill({ gym }: { gym: Gym }) {
  if (gym.sending_domain_status === "verified") {
    return <Pill tone="returned">Verified</Pill>;
  }
  if (gym.sending_domain_status === "failed") {
    return <Pill>Rejected</Pill>;
  }
  if (gym.sending_domain) return <Pill tone="teal">Awaiting DNS</Pill>;
  return <Pill>Not set up</Pill>;
}

export function SendingSettingsForm({
  gym,
  readOnly,
  sharedFrom,
}: {
  gym: Gym;
  readOnly: boolean;
  sharedFrom: string;
}) {
  const id = useId();
  const [connectState, connect, connecting] = useActionState(
    connectDomainAction,
    INITIAL,
  );
  const [checkState, check, checking] = useActionState(
    checkDomainAction,
    INITIAL,
  );
  const [dropState, drop, dropping] = useActionState(
    disconnectDomainAction,
    INITIAL,
  );

  const busy = connecting || checking || dropping;
  const state = connectState.error || connectState.message
    ? connectState
    : checkState.error || checkState.message
      ? checkState
      : dropState;

  const verified = gym.sending_domain_status === "verified";
  const fromNow = verified
    ? `${gym.sending_from_local}@${gym.sending_domain}`
    : sharedFrom;

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-1 flex items-center justify-between gap-3">
          <CardTitle>Where your emails come from</CardTitle>
          <StatusPill gym={gym} />
        </div>

        <p className="mb-4 text-[0.875rem] text-stone">
          Right now your members see messages from{" "}
          <span className="literal">
            {gym.sender_name ?? gym.name} &lt;{fromNow}&gt;
          </span>
          .
        </p>

        {verified ? (
          <p className="text-[0.875rem] text-graphite">
            That is your own domain, so a member who looks closely sees you and
            nothing else. Replies still go to{" "}
            <span className="literal">
              {gym.reply_to_email ?? gym.contact_email}
            </span>
            .
          </p>
        ) : (
          <p className="text-[0.875rem] text-graphite">
            Your gym&apos;s name is already on every message, and replies come
            straight to you. But the address itself is still casdey&apos;s, and
            it shows if a member expands the sender. Connect your own domain
            below and that disappears.
          </p>
        )}
      </Card>

      {state.error ? (
        <p role="alert" className="notice notice-error">
          {state.error}
        </p>
      ) : null}
      {state.message && !state.error ? (
        <p role="status" className="notice notice-info">
          {state.message}
        </p>
      ) : null}

      <Card>
        <CardTitle>
          {gym.sending_domain ? "Your domain" : "Use your own domain"}
        </CardTitle>

        <form action={connect} className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-[9rem]">
              <label htmlFor={`${id}-local`} className="field-label">
                Send as
              </label>
              <input
                id={`${id}-local`}
                name="local"
                defaultValue={gym.sending_from_local || "hello"}
                maxLength={64}
                disabled={readOnly || busy}
                className="field literal"
              />
            </div>
            <span className="pb-3 text-[1.125rem] text-stone">@</span>
            <div className="min-w-[16rem] flex-1">
              <label htmlFor={`${id}-domain`} className="field-label">
                Your domain
              </label>
              <input
                id={`${id}-domain`}
                name="domain"
                defaultValue={gym.sending_domain ?? ""}
                placeholder="ironworksgym.ie"
                disabled={readOnly || busy}
                className="field literal"
              />
            </div>
          </div>

          <p className="field-hint">
            The domain your gym&apos;s website or email already uses. You will
            need to add a few DNS records at whoever hosts it, which proves the
            domain is yours. Nothing sends from it until that check passes.
          </p>

          {!readOnly ? (
            <Button type="submit" disabled={busy}>
              {connecting
                ? "Setting up"
                : gym.sending_domain
                  ? "Change domain"
                  : "Connect domain"}
            </Button>
          ) : null}
        </form>
      </Card>

      {gym.sending_domain_records && gym.sending_domain_records.length > 0 ? (
        <Card>
          <CardTitle>DNS records to add</CardTitle>
          <p className="mb-4 text-[0.875rem] text-stone">
            Add these where your domain is hosted, then check again. They can
            take a few minutes to a few hours to spread. Copy the values
            exactly, including any trailing dots.
          </p>

          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-ash text-stone">
                  <th className="px-1 py-2 font-semibold">Type</th>
                  <th className="px-1 py-2 font-semibold">Name</th>
                  <th className="px-1 py-2 font-semibold">Value</th>
                </tr>
              </thead>
              <tbody>
                {gym.sending_domain_records.map((record, index) => (
                  <tr
                    key={`${record.type}-${record.name}-${index}`}
                    className="border-b border-mist align-top"
                  >
                    <td className="px-1 py-2 literal whitespace-nowrap">
                      {record.type}
                    </td>
                    <td className="px-1 py-2 literal break-all">
                      {record.name}
                    </td>
                    <td className="px-1 py-2 literal break-all">
                      {record.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {!readOnly ? (
              <form action={check}>
                <Button type="submit" disabled={busy}>
                  {checking ? "Checking" : "Check again"}
                </Button>
              </form>
            ) : null}
            {!readOnly ? (
              <form action={drop}>
                <Button type="submit" variant="quiet" disabled={busy}>
                  {dropping ? "Disconnecting" : "Disconnect"}
                </Button>
              </form>
            ) : null}
          </div>
        </Card>
      ) : null}

      {!gym.sending_domain ? (
        <Notice tone="info">
          No domain of your own? Your campaigns still go out under your gym
          name, and replies still reach you. This is a polish step, not a
          blocker.
        </Notice>
      ) : null}
    </div>
  );
}
