"use client";

import { useState } from "react";
import { FAQS } from "@/lib/content";

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="border-t border-line bg-paper py-20 lg:py-24">
      <div className="shell grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-evergreen" />
            Questions
          </p>
          <h2 className="mt-4 text-[clamp(1.8rem,1rem+2.6vw,2.6rem)] font-semibold leading-tight tracking-tight text-ink">
            Straight answers.
          </h2>
          <p className="mt-5 text-ink-soft">
            Still unsure?{" "}
            <a href="#waitlist" className="font-medium text-evergreen underline underline-offset-4">
              Ask us directly
            </a>
            .
          </p>
        </div>

        <ul className="divide-y divide-line border-y border-line">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <li key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="text-base font-semibold text-ink">{item.q}</span>
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition-transform duration-200 ${
                      isOpen ? "rotate-45 border-evergreen bg-evergreen-soft text-evergreen" : "border-line-strong text-ink-soft"
                    }`}
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
