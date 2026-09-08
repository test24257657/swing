# Design — source of truth for layout

`swing-terminal.dc.html` is the Claude Design wireframe for the whole product. It is a
single 1440px desktop canvas covering all eight screens plus the global shell:

Market Pulse · Sector Rotation · Indices · Screener (list + chart view) · Stock Detail ·
Watchlist · News · Institutional Activity.

`support.js` is the Claude Design canvas runtime it needs to render (`x-dc` / `sc-for` /
`sc-if` / `{{ }}` bindings driven by the `DCLogic` class in the HTML). It is **not**
application code — do not import it into `apps/web`.

## Viewing it

Open `swing-terminal.dc.html` directly in a browser (it loads `./support.js` relative to
itself and pulls React + fonts from CDNs). Or re-open it in Claude Design.

## Treat as canonical

- Light theme, violet accent `#7C3AED`.
- `Inter` for UI, `JetBrains Mono` for timestamps, source lines and numeric metadata.
- Tabular numerals (`font-variant-numeric: tabular-nums`) on every price / metric.
- Explicit sign on every percentage, using the Unicode minus `−` (U+2212), not `-`.
- Indian digit grouping (`1,24,102`), ₹-crore units.
- Every data panel shows a `source:` / `derived:` footer with an IST timestamp; it turns
  amber when the underlying data is stale.
- Skeleton (shimmer) loading states and explicit empty states on every screen; empty
  states route to the next action.

The `session` and `live / loading / stale / empty` switchers in the top bar are
design-mode affordances for previewing states — they are not production UI. The real
market-status pill (`trading` / `pre-open` / `closed` / `holiday`) stays.

The token values extracted from this file live in `apps/web/src/styles/tokens.css`.
