"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui";

/**
 * The hero's single field. It does not submit a signup on its own: it carries
 * the address over to /waitlist, where the gym name and the consent notice
 * live. One field here, the full form there.
 */
export function HeroEmailCapture() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    router.push(
      trimmed ? `/waitlist?email=${encodeURIComponent(trimmed)}` : "/waitlist",
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-md flex-col gap-3 sm:flex-row"
    >
      <label htmlFor="hero-email" className="sr-only">
        Your work email
      </label>
      <input
        id="hero-email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@yourgym.co.uk"
        className="min-w-0 flex-1 rounded-[10px] border border-ash bg-white px-4 py-3 text-[0.9375rem] text-ink placeholder:text-stone transition-colors duration-200 hover:border-stone focus:border-teal focus:outline-none"
      />
      <Button type="submit" className="shrink-0">
        Join the waitlist
      </Button>
    </form>
  );
}
