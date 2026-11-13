import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format Indian currency (₹ with standard commas or Cr/Lakh suffixes)
 */
export function formatINR(val?: number | null, compact = false): string {
  if (val === undefined || val === null || isNaN(val)) return "—";

  if (compact) {
    if (Math.abs(val) >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr`;
    }
    if (Math.abs(val) >= 100000) {
      return `₹${(val / 100000).toFixed(2)} L`;
    }
    if (Math.abs(val) >= 1000) {
      return `₹${(val / 1000).toFixed(1)}k`;
    }
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(val);
}

/**
 * Format Crores value
 */
export function formatCr(val?: number | null): string {
  if (val === undefined || val === null || isNaN(val)) return "—";
  return `₹${val.toFixed(2)} Cr`;
}

/**
 * Format percentage with + or -
 */
export function formatPct(val?: number | null, includeSign = true): string {
  if (val === undefined || val === null || isNaN(val)) return "—";
  const sign = includeSign && val > 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

/**
 * Format volume in readable K/M/Cr
 */
export function formatVolume(vol?: number | bigint | null): string {
  if (vol === undefined || vol === null) return "—";
  const n = typeof vol === "bigint" ? Number(vol) : vol;
  if (n >= 10000000) return `${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(2)} L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)} K`;
  return n.toLocaleString("en-IN");
}

/**
 * Score pill color classes based on 0-100 score
 */
export function getScoreBadge(score: number): {
  bg: string;
  text: string;
  label: string;
} {
  if (score >= 80) {
    return { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800 border-emerald-300 font-semibold", label: "Elite" };
  }
  if (score >= 65) {
    return { bg: "bg-sky-50 border-sky-200", text: "text-sky-800 border-sky-300 font-semibold", label: "Strong" };
  }
  if (score >= 50) {
    return { bg: "bg-amber-50 border-amber-200", text: "text-amber-800 border-amber-300 font-semibold", label: "Setup" };
  }
  return { bg: "bg-slate-100 border-slate-200", text: "text-slate-700 border-slate-300 font-semibold", label: "Neutral" };
}

/**
 * Stage color classes
 */
export function getStageBadge(stage: string): { bg: string; text: string } {
  switch (stage) {
    case "2A":
      return { bg: "bg-emerald-50 border-emerald-300", text: "text-emerald-800 font-semibold" };
    case "2B":
      return { bg: "bg-sky-50 border-sky-300", text: "text-sky-800 font-semibold" };
    case "1":
      return { bg: "bg-blue-50 border-blue-300", text: "text-blue-800 font-semibold" };
    case "3":
      return { bg: "bg-amber-50 border-amber-300", text: "text-amber-800 font-semibold" };
    default:
      return { bg: "bg-rose-50 border-rose-300", text: "text-rose-800 font-semibold" };
  }
}
