"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export type Nudge = { text: string; href: string; cta: string };
type Msg = { role: "user" | "assistant"; content: string };

export function Assistant({
  nudges,
  starters,
  aiEnabled,
}: {
  nudges: Nudge[];
  starters: string[];
  aiEnabled: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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
    <div className="mt-6">
      {/* Proactive suggestions */}
      <div className="space-y-2">
        {nudges.map((n) => (
          <Link
            key={n.href + n.text}
            href={n.href}
            prefetch
            className="flex items-center justify-between gap-3 rounded-xl border border-evergreen/25 bg-evergreen-soft px-5 py-3.5 transition-colors hover:border-evergreen/40"
          >
            <span className="text-sm text-ink">{n.text}</span>
            <span className="whitespace-nowrap text-sm font-semibold text-evergreen">
              {n.cta} →
            </span>
          </Link>
        ))}
      </div>

      {!aiEnabled && (
        <p className="mt-4 rounded-xl border border-line bg-paper-dim/50 px-4 py-2.5 text-xs text-ink-soft">
          Chat is read-only until an Anthropic API key is added to Mizan. The
          suggestions above work now.
        </p>
      )}

      {/* Chat */}
      <div className="card mt-6 flex h-[26rem] flex-col p-0">
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-lg font-semibold text-ink">Ask me about your books</p>
              <p className="mt-1 max-w-sm text-sm text-ink-soft">
                I can explain your figures, VAT and tax, and walk you through what
                needs doing.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {starters.map((s) => (
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
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "user"
                      ? "bg-evergreen text-sidebar"
                      : "border border-line bg-surface text-ink"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm text-ink-soft">
                Thinking…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 border-t border-line p-3"
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
  );
}
