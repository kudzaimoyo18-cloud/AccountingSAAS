"use client";

import { useState } from "react";
import { UK_FAQS } from "@/lib/uk-content";

export function UkFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="border-t border-line bg-paper-dim/50 py-20 lg:py-28">
      <div className="shell grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="eyebrow">
            <span className="h-px w-6 bg-brass-deep" />
            Questions
          </p>
          <h2 className="mt-5 font-display text-[clamp(1.9rem,1rem+3vw,3rem)] font-semibold leading-tight tracking-[-0.02em]">
            Straight answers.
          </h2>
          <p className="mt-5 text-ink-soft">
            Still unsure?{" "}
            <a href="#waitlist" className="text-brass-deep underline underline-offset-4">
              Ask us directly
            </a>
            .
          </p>
        </div>

        <ul className="divide-y divide-line border-y border-line">
          {UK_FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <li key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="font-display text-lg font-medium">{item.q}</span>
                  <span
                    className={
                      isOpen
                        ? "grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-transform duration-200 rotate-45 border-brass text-brass-deep"
                        : "grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line transition-transform duration-200 text-ink-soft"
                    }
                    aria-hidden
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path
                        d="M6.5 1v11M1 6.5h11"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </button>
                <div
                  className="grid transition-all duration-300 ease-out"
                  style={{
                    gridTemplateRows: isOpen ? "1fr" : "0fr",
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <div className="overflow-hidden">
                    <p className="pb-5 pr-10 text-[0.95rem] leading-relaxed text-ink-soft">
                      {item.a}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
