/**
 * Formatting utilities for financial numbers, percentages and currency.
 */

export function formatINR(val, decimals = 2) {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

export function formatCrores(val) {
  if (val === null || val === undefined || isNaN(val)) return "—";
  const abs = Math.abs(Math.round(val));
  const sign = val >= 0 ? "+" : "−";
  return `${sign}₹${new Intl.NumberFormat("en-IN").format(abs)} Cr`;
}

export function formatPct(val, showPlus = true, decimals = 2) {
  if (val === null || val === undefined || isNaN(val)) return "—";
  const sign = showPlus && val > 0 ? "+" : "";
  return `${sign}${val.toFixed(decimals)}%`;
}

export function formatNumberWithSign(val) {
  if (val === null || val === undefined || isNaN(val)) return "—";
  const sign = val > 0 ? "+" : val < 0 ? "−" : "";
  return `${sign}${new Intl.NumberFormat("en-IN").format(Math.abs(val))}`;
}

export function formatPoints(val) {
  if (val === null || val === undefined || isNaN(val)) return "—";
  const sign = val > 0 ? "+" : val < 0 ? "−" : "";
  return `${sign}${Math.abs(val).toFixed(1)} pts`;
}

