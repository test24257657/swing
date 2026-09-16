"use client";

import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";

import { Send } from "lucide-react";

import { Button, Card } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useStockChat } from "@/lib/api/market-hooks";
import type { ChatTurn } from "@/lib/api/market-types";
import { cn } from "@/lib/cn";

const STARTERS = [
  "Should I buy now or wait? Why?",
  "Is the big deal in this stock real buying?",
  "Where is my stop and what's the risk?",
];

/** `**bold**` inline — the only inline markup the prompt asks the model for. Rendered
 * as elements, never as HTML, so model output can't inject markup. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-text">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function Answer({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-[12.5px] leading-relaxed text-text-secondary">
      {text.split("\n").map((raw, i) => {
        const line = raw.trim();
        if (!line) return null;
        if (/^_.*_$/.test(line)) {
          return (
            <p key={i} className="pt-1 text-[11px] italic text-text-faint">
              {line.slice(1, -1)}
            </p>
          );
        }
        if (/^[-*] /.test(line)) {
          return (
            <div key={i} className="flex gap-1.5 pl-1">
              <span className="text-text-faint">•</span>
              <span className="min-w-0">{inline(line.slice(2))}</span>
            </div>
          );
        }
        return <p key={i}>{inline(line)}</p>;
      })}
    </div>
  );
}

export function StockChat({ slug, symbol }: { slug: string; symbol: string }) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const chat = useStockChat(slug);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages, chat.isPending]);

  function ask(question: string) {
    const q = question.trim();
    if (!q || chat.isPending) return;
    const next: ChatTurn[] = [...messages, { role: "user", text: q }];
    setMessages(next);
    setDraft("");
    chat.mutate(next, {
      onSuccess: (res) => {
        setMessages((cur) => [...cur, { role: "model", text: res.data.answer }]);
        setUsage({ used: res.data.used_today, limit: res.data.daily_limit });
      },
      // Drop the unanswered question so a retry doesn't send it twice in the history.
      onError: () => setMessages((cur) => cur.slice(0, -1)),
    });
  }

  const error = chat.error instanceof ApiError ? chat.error.detail : chat.error ? "Something went wrong." : null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold">Ask AI about {symbol}</h2>
          <span className="rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-tint)] px-2 py-0.5 text-[11px] font-medium text-accent">
            ✦ AI
          </span>
        </div>
        {usage && (
          <span className="font-mono text-[11px] text-text-faint">
            {usage.used}/{usage.limit} today
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
        Answers only from this stock&apos;s data — price, setup, big deals, F&amp;O, results, news and sector.
      </p>

      {messages.length > 0 && (
        <div className="mt-3 max-h-[480px] space-y-2.5 overflow-y-auto pr-1">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-lg bg-[var(--color-accent-tint)] px-3 py-2 text-[12.5px] text-text">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={i} className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                <Answer text={m.text} />
              </div>
            ),
          )}
          {chat.isPending && (
            <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[12px] text-text-muted">
              Reading the data…
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {messages.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              disabled={chat.isPending}
              className="rounded-full border border-border px-2.5 py-1 text-[11.5px] text-text-secondary hover:border-[var(--color-accent-border)] hover:text-accent disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <div className="mt-2.5 text-[12px] text-down-text">{error}</div>}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={1000}
          placeholder="Ask anything about this stock…"
          aria-label={`Ask AI about ${symbol}`}
          className={cn(
            "h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-[13px] outline-none",
            "placeholder:text-text-faint focus:border-[var(--color-accent-border)]",
          )}
        />
        <Button type="submit" disabled={chat.isPending || !draft.trim()} aria-label="Send">
          <Send size={14} />
        </Button>
      </form>
    </Card>
  );
}
