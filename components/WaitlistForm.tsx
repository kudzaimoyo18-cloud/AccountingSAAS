"use client";

import { useState, FormEvent } from "react";

const STAGES = [
  "Just registered",
  "Trading, no accountant",
  "Have an accountant",
  "Behind on filings",
];

type Status = "idle" | "loading" | "done" | "error";

export function WaitlistForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    const form = e.currentTarget;
    const data = {
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      company: (form.elements.namedItem("company") as HTMLInputElement).value,
      stage: (form.elements.namedItem("stage") as HTMLSelectElement).value,
    };

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(json.error ?? "Something went wrong.");
        return;
      }
      setStatus("done");
      form.reset();
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-2xl border border-evergreen/30 bg-evergreen/5 p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-evergreen/15">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
            <path
              d="M5 11l4 4 8-9"
              stroke="var(--evergreen)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="mt-4 font-display text-xl font-medium">You&apos;re on the list.</h3>
        <p className="mt-2 text-sm text-ink-soft">
          We&apos;ll reach out as we open founding spots. First 50 companies get
          setup free.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Work email"
          className="field"
          aria-label="Work email"
        />
        <input
          name="company"
          type="text"
          placeholder="Company name (optional)"
          className="field"
          aria-label="Company name"
        />
      </div>
      <select name="stage" className="field" aria-label="Where you are" defaultValue="">
        <option value="" disabled>
          Where are you today?
        </option>
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <button type="submit" disabled={status === "loading"} className="btn-primary w-full">
        {status === "loading" ? "Joining…" : "Claim a founding spot"}
      </button>

      {status === "error" && (
        <p role="alert" className="text-sm text-[#b3261e]">
          {message}
        </p>
      )}
      <p className="text-center text-xs text-ink-soft">
        No spam. We&apos;ll only email you about early access.
      </p>
    </form>
  );
}
