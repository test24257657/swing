# Aceternity UI components

Aceternity UI is copy-in, not a package. Add components here with:

```bash
npx shadcn@latest add "https://ui.aceternity.com/registry/<component>.json"
```

They import `cn` from `@/lib/utils` (provided) and animate with `motion` (installed).

## Where they fit this product

The design is a dense, flat trading terminal — most of Aceternity's marketing-page
effects do not belong. Use it sparingly and only where the design already implies motion:

- number **flash** on price change (Pulse index cards, Stock Detail header) — a small
  motion highlight
- the **command palette** (⌘K) overlay
- subtle card hover / border-glow on the screener chart cards
- skeleton shimmer (already handled by the `Skeleton` primitive)

Keep the base primitives in `components/ui/` (Button, Card, Table, Chip, Segmented,
Accordion, Tooltip, Skeleton) — Aceternity does not cover dense data-table needs.
