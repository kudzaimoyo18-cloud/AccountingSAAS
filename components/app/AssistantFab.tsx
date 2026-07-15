"use client";

import { useState, useRef, useEffect } from "react";

// Floating assistant button (bottom-right) that opens a slide-up chat sheet over
// the current screen — ask about your books without leaving the page. On phones
// it floats just above the bottom tab bar; on desktop it sits bottom-right.
// Talks to the same /api/assistant endpoint as the full Assistant page.

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "How much VAT do I owe?",
  "What's my profit this month?",
  "What still needs my approval?",
];

export function AssistantFab() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  // Lock body scroll while the sheet is open (mobile).
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json()) as { reply?: string };
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? "…" }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Network error — please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask the assistant"
          className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-evergreen text-sidebar shadow-lift transition-transform hover:bg-evergreen-deep active:scale-95 md:bottom-6 md:right-6 print:hidden"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 3C7 3 3 6.4 3 10.6c0 2.3 1.2 4.3 3.1 5.7L5.4 20l3.9-2a10.6 10.6 0 0 0 2.7.3c5 0 9-3.4 9-7.7S17 3 12 3z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M8.5 10.5h7M8.5 13h4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {/* Chat sheet */}
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-label="Assistant">
          <button
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
          />
          <div className="absolute inset-x-0 bottom-0 flex h-[80vh] flex-col rounded-t-2xl border-t border-line bg-surface shadow-lift sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[32rem] sm:w-[24rem] sm:rounded-2xl sm:border">
            {/* header */}
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-evergreen-soft text-evergreen">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 3C7 3 3 6.4 3 10.6c0 2.3 1.2 4.3 3.1 5.7L5.4 20l3.9-2a10.6 10.6 0 0 0 2.7.3c5 0 9-3.4 9-7.7S17 3 12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                </span>
                <p className="text-sm font-semibold text-ink">Assistant</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-paper-dim hover:text-ink"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* messages */}
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="text-base font-semibold text-ink">Ask me about your books</p>
                  <p className="mt-1 max-w-xs text-sm text-ink-soft">
                    Your figures, VAT and tax, and what needs doing.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {STARTERS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="rounded-lg border border-line-strong px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-evergreen hover:text-evergreen"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
                        m.role === "user"
                          ? "bg-evergreen text-sidebar"
                          : "border border-line bg-paper-dim text-ink"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-line bg-paper-dim px-3.5 py-2.5 text-sm text-ink-soft">
                    Thinking…
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 border-t border-line p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your books…"
                className="field flex-1"
                aria-label="Message the assistant"
              />
              <button type="submit" className="btn-primary" disabled={loading || !input.trim()}>
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
