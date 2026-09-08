/**
 * Number and price formatting — the single source of truth.
 *
 * Rules taken from design/swing-terminal.dc.html:
 *  - Indian digit grouping (1,24,102) via en-IN.
 *  - The Unicode minus sign U+2212 ("−"), never the hyphen-minus, on every negative
 *    number and every signed percentage.
 *  - Percentages and changes always carry an explicit sign (+ or −).
 *  - Currency in ₹ with crore / lakh suffixes for large values.
 *  - Callers pair these with the `.tnum` class (tabular figures).
 */

const MINUS = "−"; // −

const inr = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const inrInt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function sign(n: number): string {
  return n < 0 ? MINUS : "+";
}

/** Fix the hyphen-minus that Intl emits into the typographic minus. */
function fixMinus(s: string): string {
  return s.replace(/-/g, MINUS);
}

/** Plain price, 2 dp, grouped: 1,024.35 */
export function price(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return fixMinus(inr.format(n));
}

/** Signed absolute change: +28.50 / −0.46 */
export function change(n: number | null | undefined, dp = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return sign(n) + inr.format(Math.abs(n)).replace(/\.00$/, dp === 2 ? ".00" : "");
}

/** Signed percentage: +2.86% / −3.75% */
export function pct(n: number | null | undefined, dp = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${sign(n)}${Math.abs(n).toFixed(dp)}%`;
}

/** Unsigned percentage (e.g. delivery %): 71.0% */
export function pctPlain(n: number | null | undefined, dp = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(dp)}%`;
}

/** Volume ratio: 2.4× */
export function ratio(n: number | null | undefined, dp = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(dp)}×`;
}

/** Compact rupee value with Indian scale words: ₹3.77L cr, ₹412.8 cr, ₹4,286 */
export function inrCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const s = n < 0 ? MINUS : "";
  if (abs >= 1e12) return `${s}₹${(abs / 1e12).toFixed(2)}L cr`;
  if (abs >= 1e7) return `${s}₹${(abs / 1e7).toFixed(abs >= 1e9 ? 0 : 1)} cr`;
  if (abs >= 1e5) return `${s}₹${(abs / 1e5).toFixed(2)} L`;
  return `${s}₹${inrInt.format(abs)}`;
}

/** Whole-number count, grouped: 1,382 */
export function count(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return fixMinus(inrInt.format(n));
}

/** Direction of a value, for colour tokens. */
export function direction(n: number | null | undefined): "up" | "down" | "flat" {
  if (n == null || Number.isNaN(n) || n === 0) return "flat";
  return n > 0 ? "up" : "down";
}

const IST_TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
  hour12: false,
});
const IST_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "Asia/Kolkata",
});

/** "06 Sep · 15:58 IST" — used in every data-source footer. */
export function istStamp(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return `${IST_DATE.format(d)} · ${IST_TIME.format(d)} IST`;
}
