"use client";

/**
 * Market-status pill. Four states driven by the NSE holiday calendar:
 * trading / pre-open / closed / holiday (incl. Muhurat). Phase 0 derives the state
 * client-side from IST wall-clock + weekends; a real holiday calendar endpoint replaces
 * `deriveStatus` in a later phase.
 *
 * The design's separate `session` switcher is a preview affordance and is NOT rendered
 * in production.
 */

type Status = "trading" | "preopen" | "closed" | "holiday";

interface StatusView {
  label: string;
  fg: string;
  bg: string;
  bd: string;
  dot: string;
}

const VIEWS: Record<Status, StatusView> = {
  trading: {
    label: "Market open",
    fg: "var(--color-up-text)",
    bg: "rgba(22,163,74,0.10)",
    bd: "rgba(22,163,74,0.28)",
    dot: "var(--color-up)",
  },
  preopen: {
    label: "Pre-open",
    fg: "var(--color-stale-text)",
    bg: "rgba(217,119,6,0.12)",
    bd: "rgba(217,119,6,0.32)",
    dot: "var(--color-stale)",
  },
  closed: {
    label: "Market closed",
    fg: "var(--color-down-text)",
    bg: "rgba(220,38,38,0.10)",
    bd: "rgba(220,38,38,0.28)",
    dot: "var(--color-down)",
  },
  holiday: {
    label: "Market closed — holiday",
    fg: "var(--color-stale-text)",
    bg: "rgba(217,119,6,0.12)",
    bd: "rgba(217,119,6,0.32)",
    dot: "var(--color-stale)",
  },
};

function nowIST(): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    day: days.indexOf(get("weekday")),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function deriveStatus(): Status {
  const { day, minutes } = nowIST();
  if (day === 0 || day === 6) return "closed";
  if (minutes >= 540 && minutes < 555) return "preopen"; // 09:00–09:15
  if (minutes >= 555 && minutes <= 930) return "trading"; // 09:15–15:30
  return "closed";
}

export function MarketStatusPill() {
  const status = deriveStatus();
  const v = VIEWS[status];
  return (
    <div
      className="flex h-[26px] items-center gap-2 rounded-full border px-2.5"
      style={{ background: v.bg, borderColor: v.bd }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: v.dot }} />
      <span className="text-[11px] font-medium whitespace-nowrap" style={{ color: v.fg }}>
        {v.label}
      </span>
    </div>
  );
}
