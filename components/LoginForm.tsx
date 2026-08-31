"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { authClient } from "@/lib/auth-client";

// Email + password against self-hosted Better Auth. There is no external auth
// service and no OTP round trip: sign-up and sign-in are one form, matching the
// old copy ("your account is created on first sign-in").

type Mode = "signin" | "signup";

export function LoginForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
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
      const message = result.error.message ?? "";
      // Signing up with an address that already has an account is a dead end
      // otherwise — the user's actual intent is almost always to sign in, so
      // switch them over with the email kept rather than making them retype it.
      if (mode === "signup" && /already exists/i.test(message)) {
        setMode("signin");
        setError("That email already has an account — enter your password to sign in.");
        setBusy(false);
        return;
      }
      setError(message || "Could not sign you in. Check your details.");
      setBusy(false);
      return;
    }

    // The session cookie is set by the time this resolves; refresh so the server
    // components pick it up, then land on the app.
    router.push(next);
    router.refresh();
  }

  async function signInWithGoogle() {
    setError(null);
    setBusy(true);
    const { error: err } = await authClient.signIn.social({
      provider: "google",
      callbackURL: next,
    });
    // On success the browser is redirected to Google, so this only runs on error.
    if (err) {
      setError(err.message ?? "Could not start Google sign-in.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {googleEnabled && (
        <>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="btn-ghost w-full disabled:opacity-60"
          >
            <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.95L3.97 7.3C4.68 5.16 6.66 3.58 9 3.58z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-xs uppercase tracking-wider text-ink-soft">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

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
