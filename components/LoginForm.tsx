"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { authClient } from "@/lib/auth-client";

// Email + password against self-hosted Better Auth. There is no external auth
// service and no OTP round trip: sign-up and sign-in are one form, matching the
// old copy ("your account is created on first sign-in").

type Mode = "signin" | "signup";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/app";

  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    const result =
      mode === "signup"
        ? await authClient.signUp.email({
            email,
            password,
            // Better Auth requires a name; fall back to the local part so the
            // field can stay optional in the UI.
            name: name || email.split("@")[0],
          })
        : await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? "Could not sign you in. Check your details.");
      setBusy(false);
      return;
    }

    // The session cookie is set by the time this resolves; refresh so the server
    // components pick it up, then land on the app.
    router.push(next);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        {mode === "signup" && (
          <input
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            className="field"
            aria-label="Your name"
          />
        )}
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className="field"
          aria-label="Email address"
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder="Password (8+ characters)"
          className="field"
          aria-label="Password"
        />
        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
          {busy
            ? mode === "signup"
              ? "Creating your account…"
              : "Signing in…"
            : mode === "signup"
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <p className="text-center text-sm text-ink-soft">
        {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
        <button
          type="button"
          className="font-medium text-ink underline underline-offset-2"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
        >
          {mode === "signin" ? "Create one" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
