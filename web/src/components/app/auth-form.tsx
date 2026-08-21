"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "./ui";
import { IconGoogle } from "./icons";

type Mode = "signin" | "signup" | "reset";
type Status = "idle" | "working" | "sent" | "error";

/**
 * Sign in and sign up in one form, because they are the same three fields and
 * splitting them across two pages only adds a decision nobody wants to make.
 *
 * The handshake is the only thing the browser client is ever used for. Member
 * data is rendered on the server, under RLS, and never fetched from here.
 */
export function AuthForm({
  initialMode,
  next,
}: {
  initialMode: Mode;
  next: string;
}) {
  const router = useRouter();
  const id = useId();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const working = status === "working";

  function readableError(raw: string): string {
    // Supabase's own wording is fine in most cases, but these two come up
    // constantly and its phrasing does not say what to do next.
    if (/invalid login credentials/i.test(raw)) {
      return "That email and password do not match an account.";
    }
    if (/user already registered/i.test(raw)) {
      return "There is already an account with that email. Sign in instead.";
    }
    return raw;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setStatus("working");
    setMessage("");

    const supabase = supabaseBrowser();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (error) {
        setStatus("error");
        setMessage(readableError(error.message));
        return;
      }

      // With email confirmation switched on there is no session yet, so there
      // is nowhere to send them except back to their inbox.
      if (!data.session) {
        setStatus("sent");
        setMessage(email);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setStatus("error");
        setMessage(readableError(error.message));
        return;
      }
    }

    // refresh() first so the Server Components on the next screen see the new
    // session cookie rather than rendering as signed out.
    router.refresh();
    router.push(next);
  }

  async function onReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();

    setStatus("working");
    setMessage("");

    const supabase = supabaseBrowser();
    // Sends a recovery link back through /auth/callback, which exchanges it for
    // a session and lands the user on /reset-password to choose a new one.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
    setMessage(email);
  }

  async function onGoogle() {
    setStatus("working");
    setMessage("");
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    }
    // On success the browser is already navigating to Google.
  }

  if (status === "sent") {
    const isReset = mode === "reset";
    return (
      <div className="card p-7">
        <h1 className="display text-[1.375rem]">
          {isReset ? "Check your email" : "Confirm your email"}
        </h1>
        <p className="mt-3 text-[0.9375rem] text-graphite">
          We sent {isReset ? "a password reset link" : "a link"} to{" "}
          <span className="literal text-ink">{message}</span>.{" "}
          {isReset
            ? "Open it to choose a new password."
            : "Open it and you are in."}{" "}
          It can take a minute, and it sometimes lands in spam.
        </p>
      </div>
    );
  }

  if (mode === "reset") {
    return (
      <div className="card p-7">
        <h1 className="display text-[1.5rem]">Reset your password</h1>
        <p className="mt-2 text-[0.9375rem] text-graphite">
          Enter your work email and we will send you a link to set a new one.
        </p>

        <form onSubmit={onReset} noValidate className="mt-6">
          <div className="mb-5">
            <label htmlFor={`${id}-reset-email`} className="field-label">
              Work email
            </label>
            <input
              id={`${id}-reset-email`}
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={working}
              className="field"
              placeholder="you@yourgym.co.uk"
            />
          </div>

          {status === "error" ? (
            <p role="alert" className="notice notice-error mb-4">
              {message}
            </p>
          ) : null}

          <Button type="submit" disabled={working} className="w-full">
            {working ? "One moment" : "Send reset link"}
          </Button>
        </form>

        <p className="mt-5 text-center text-[0.875rem] text-graphite">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setStatus("idle");
              setMessage("");
            }}
            className="font-semibold text-teal underline underline-offset-4 hover:no-underline"
          >
            Back to sign in
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="card p-7">
      <h1 className="display text-[1.5rem]">
        {mode === "signup" ? "Start your free week" : "Sign in"}
      </h1>
      <p className="mt-2 text-[0.9375rem] text-graphite">
        {mode === "signup"
          ? "Seven days free. Set up your gym, import your list, see who has gone quiet."
          : "Welcome back."}
      </p>

      <button
        type="button"
        onClick={onGoogle}
        disabled={working}
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-[10px] border border-ash bg-white px-4 py-2.5 text-[0.9375rem] font-semibold text-ink transition-[transform,border-color] duration-200 ease-out hover:-translate-y-px hover:border-stone disabled:opacity-55 disabled:hover:translate-y-0"
      >
        <IconGoogle />
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-ash" />
        <span className="label text-stone">or</span>
        <span className="h-px flex-1 bg-ash" />
      </div>

      <form onSubmit={onSubmit} noValidate>
        <div className="mb-4">
          <label htmlFor={`${id}-email`} className="field-label">
            Work email
          </label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={working}
            className="field"
            placeholder="you@yourgym.co.uk"
          />
        </div>

        <div className="mb-5">
          <label htmlFor={`${id}-password`} className="field-label">
            Password
          </label>
          <input
            id={`${id}-password`}
            name="password"
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            required
            minLength={8}
            disabled={working}
            className="field"
            placeholder={mode === "signup" ? "At least 8 characters" : ""}
          />
          {mode === "signin" ? (
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => {
                  setMode("reset");
                  setStatus("idle");
                  setMessage("");
                }}
                className="text-[0.8125rem] font-semibold text-teal underline underline-offset-4 hover:no-underline"
              >
                Forgot password?
              </button>
            </div>
          ) : null}
        </div>

        {status === "error" ? (
          <p role="alert" className="notice notice-error mb-4">
            {message}
          </p>
        ) : null}

        <Button type="submit" disabled={working} className="w-full">
          {working
            ? "One moment"
            : mode === "signup"
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>

      <p className="mt-5 text-center text-[0.875rem] text-graphite">
        {mode === "signup" ? "Already have an account?" : "No account yet?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setStatus("idle");
            setMessage("");
          }}
          className="font-semibold text-teal underline underline-offset-4 hover:no-underline"
        >
          {mode === "signup" ? "Sign in" : "Start your free week"}
        </button>
      </p>
    </div>
  );
}
