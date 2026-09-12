/**
 * Wrap every bare `Nfr` track in `minmax(0, Nfr)`.
 *
 * A grid item's default automatic minimum size is its content's min-content width, not
 * 0 — so a bare `1fr` track holding something wide (a table wrapped in
 * `overflow-x-auto`, a fixed-width sparkline, anything with a `min-w-[...]`) grows the
 * whole track, and the whole page, to fit it instead of scrolling locally. `minmax(0,
 * 1fr)` is the standard fix. Tailwind's own `grid-cols-N` utilities already do this;
 * this is for the `grid-template-columns` values built by hand — arbitrary
 * `grid-cols-[...]` classes and inline `style={{ gridTemplateColumns }}` alike.
 */
export function safeGridCols(template: string): string {
  return template.replace(/(?<![\w.-])(\d*\.?\d+fr)(?![\w-])/g, "minmax(0, $1)");
}
