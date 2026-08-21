"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./ui";
import { IconCheck } from "./marks/icons";

type Status = "idle" | "submitting" | "success" | "error";

const FIELD =
  "w-full rounded-[10px] border border-ash bg-white px-4 py-3 text-[0.9375rem] text-ink placeholder:text-stone " +
  "transition-colors duration-200 hover:border-stone focus:border-teal focus:outline-none";

const LABEL = "block text-[0.875rem] font-semibold text-ink";

export function WaitlistForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const prefix = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  // Bots tend to submit instantly. A form filled in under a couple of seconds
  // is almost never a person, so we timestamp the mount and check it server side.
  const mountedAt = useRef<number | null>(null);
  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    const form = event.currentTarget;
    const data = new FormData(form);

    setStatus("submitting");
    setMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(data.get("email") ?? "").trim(),
          gym: String(data.get("gym") ?? "").trim(),
          software: String(data.get("software") ?? "").trim(),
          // Honeypot. A real person never sees this field, so anything in it
          // means the submission is automated.
          website: String(data.get("website") ?? ""),
          // null means the mount effect never ran, so the server treats the
          // timing check as inconclusive rather than as bot evidence.
          elapsedMs:
            mountedAt.current === null ? null : Date.now() - mountedAt.current,
        }),
      });

      const body: { ok?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}));

      if (!res.ok || !body.ok) {
        setStatus("error");
        setMessage(
          body.error ??
            "Something went wrong on our side. Try again, or email info@casdey.com and we will add you by hand.",
        );
        return;
      }

      form.reset();
      setStatus("success");
    } catch {
      setStatus("error");
      setMessage(
        "We could not reach the server. Check your connection and try again.",
      );
    }
  }

  if (status === "success") {
    return (
      <div
        className="rounded-[22px] bg-white p-8 shadow-raised sm:p-10"
        role="status"
        aria-live="polite"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-shallow text-teal">
          <IconCheck className="h-5 w-5" />
        </span>
        <p className="display mt-5 text-[1.75rem] text-ink">
          You are on the list.
        </p>
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-graphite">
          We will email you when casdey is ready for your gym, with the free
          first week attached. Nothing else in the meantime.
        </p>
        <p className="label mt-6 text-stone">
          questions before then? info@casdey.com
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[22px] bg-white p-8 shadow-raised sm:p-10"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor={`${prefix}-gym`}>
            Gym or studio name
          </label>
          <input
            id={`${prefix}-gym`}
            name="gym"
            type="text"
            required
            autoComplete="organization"
            placeholder="Riverside Fitness"
            className={`${FIELD} mt-2`}
          />
        </div>

        <div>
          <label className={LABEL} htmlFor={`${prefix}-email`}>
            Work email
          </label>
          <input
            id={`${prefix}-email`}
            name="email"
            type="email"
            required
            defaultValue={defaultEmail}
            autoComplete="email"
            placeholder="you@yourgym.co.uk"
            className={`${FIELD} mt-2`}
          />
        </div>
      </div>

      <div className="mt-5">
        <label className={LABEL} htmlFor={`${prefix}-software`}>
          Membership software{" "}
          <span className="font-normal text-stone">(optional)</span>
        </label>
        <input
          id={`${prefix}-software`}
          name="software"
          type="text"
          placeholder="Mindbody, Glofox, ABC Fitness, something else"
          className={`${FIELD} mt-2`}
        />
        <p className="mt-2 text-[0.8125rem] text-stone">
          Telling us yours moves it up the list of systems we connect to first.
        </p>
      </div>

      {/* Honeypot. Hidden from people, catnip for bots. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor={`${prefix}-website`}>Website</label>
        <input
          id={`${prefix}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Joining..." : "Join the waitlist"}
        </Button>
        <p className="label text-stone">free first week · no card</p>
      </div>

      {status === "error" ? (
        <p
          className="mt-5 rounded-[10px] bg-mist px-4 py-3 text-[0.9375rem] text-ink"
          role="alert"
          aria-live="assertive"
        >
          {message}
        </p>
      ) : null}

      <p className="mt-7 border-t border-mist pt-6 text-[0.8125rem] leading-relaxed text-stone">
        Joining the list means we can email you about casdey&apos;s launch and
        nothing else. No newsletter, no sharing your details with anyone, and
        one click to come off the list at any time. See the{" "}
        <Link
          href="/privacy"
          className="text-teal underline decoration-ash underline-offset-4 transition-colors duration-200 hover:decoration-teal"
        >
          privacy notice
        </Link>
        .
      </p>
    </form>
  );
}
