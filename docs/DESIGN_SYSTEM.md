# Unified Institutional Design System

A centralized, production-grade design system for the Indian Equities Momentum & Market Breadth platform.

---

## 1. Design Philosophy

- **Institutional Clarity:** Clean, information-dense, high-precision financial analytics.
- **Single Source of Truth:** Centralized design tokens governing all colors, typography, spacing, radius, and chart themes.
- **Light Theme Only:** Pure white card surfaces (`#FFFFFF`), subtle canvas (`#F8FAFC`), and dark navy text (`#17233B`).
- **Standardized Financial Conventions:** Unambiguous color and symbol conventions for Indian market data.

---

## 2. Centralized Color Palette

| Token | Hex Value | Semantic Usage |
|-------|-----------|----------------|
| `primary` | `#3478F6` | Primary brand accent, active tabs, action buttons |
| `primaryHover` | `#2563EB` | Button hover state |
| `primarySubtle` | `#EFF6FF` | Selected background, subtle badges |
| `bgMain` | `#FFFFFF` | Card surfaces, modals, popovers |
| `bgSecondary` | `#F8FAFC` | Page background, alternating rows |
| `textPrimary` | `#17233B` | Main headings, financial metrics, labels |
| `textSecondary` | `#64748B` | Explanatory text, subtitle, table column headers |
| `textMuted` | `#94A3B8` | Footnotes, timestamps, inactive icons |
| `border` | `#E5EAF2` | Standard card and table borders |
| `borderSubtle` | `#F1F5F9` | Inner dividers and secondary separators |
| `bullish` | `#16A878` | Advancing stocks, positive returns, uptrend stages |
| `bullishBg` | `#E8F8F3` | Positive return badges, bullish sentiment pills |
| `bearish` | `#F05283` | Declining stocks, negative returns, downtrend stages |
| `bearishBg` | `#FEF0F4` | Negative return badges, bearish sentiment pills |
| `warning` | `#E9A23B` | Stage 3 Top, choppy market warnings |
| `benchmark` | `#94A3B8` | Nifty 500 benchmark line |

---

## 3. Typography & Numerals

- **Primary Font:** `Inter` (`font-sans`)
- **Monospace Font:** `JetBrains Mono` (`font-mono`)
- **Financial Numerals:** Always use tabular numerals (`tabular-nums` / `.tnum`) to ensure strict vertical alignment across columns.
- **Type Scale:**
  - Page Title: `15px` / `font-bold` / `#17233B`
  - Section Title: `13px` / `font-bold` / uppercase / `#17233B`
  - Card Metric: `18px` – `24px` / `font-bold` / `tabular-nums`
  - Body Text: `12px` / `font-normal` / `#64748B`
  - Footnote / Subtext: `10px` – `11px` / `font-medium` / `#94A3B8`

---

## 4. Spacing, Radius & Elevation

- **Grid Unit:** 4px baseline scale.
  - Card Padding: `p-3.5` or `p-4` (14px–16px)
  - Section Gaps: `gap-3` or `gap-3.5` (12px–14px)
  - Element Spacing: `gap-2` (8px)
- **Radius Tokens:**
  - Micro / Pill: `rounded-[4px]`
  - Button / Control: `rounded-[6px]`
  - Card / Panel: `rounded-[8px]`
  - Modal / Sheet: `rounded-[12px]`
- **Elevation:**
  - Cards: `shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]` (minimal, borders preferred over heavy shadows)
  - Dropdowns: `shadow-md`

---

## 5. Chart Design System (Recharts)

All charts use centralized presets defined in `src/lib/chart-theme.js`:

```javascript
import { CHART_THEME } from "@/lib/chart-theme";
```

### Chart Conventions:
1. **Responsive Dimensions:** Every chart uses `ResponsiveContainer` with responsive auto-resizing.
2. **Subtle Grids:** Horizontal grid lines only (`stroke="#F1F5F9"`, `strokeDasharray="3 3"`). No vertical grid lines.
3. **Axis Styling:** Minimal font size (`10px`), muted color (`#94A3B8`), tick lines hidden.
4. **Tooltips:** Clean white tooltip with `#E5EAF2` border, subtle shadow, date header, and color-coded indicator dots (`ChartTooltip`).
5. **Diverging Bar Charts:**
   - Blue (`#3478F6`) or Green (`#16A878`) for positive values above zero line.
   - Pink (`#F05283`) for negative values below zero line.

---

## 6. Financial Data Visualization Rules

- **Currency:** Indian Rupee (`₹`) formatted with standard Indian grouping:
  - Thousands: `₹1,234`
  - Crores: `₹5,737 Cr`
- **Percentage:** Always explicitly signed when representing change: `+2.45%` (green) or `-1.20%` (pink).
- **Tabular Alignment:** All numerical data in tables and cards right-aligned with monospace/tabular digits.
- **Never Rely Solely on Color:** Pair colors with signs (`+` / `−`), arrows (`▲` / `▼`), or explicit text labels (`Up`, `Down`, `Held`).

---

## 7. Reusable Component Catalog

### UI Components (`src/components/ui/`)
- `Button`: `PrimaryButton`, `SecondaryButton`, `OutlineButton`, `GhostButton`, `DestructiveButton`, `IconButton`
- `BaseCard`, `SectionCard`, `ChartCard`, `MetricCard`, `StatCard`, `InformationCard`
- `StatusBadge`, `PillBadge`
- `SegmentedControl` (e.g. `20D / 50D / 200D`, `1M / 3M / 1Y`)
- `Select`, `Input`, `SearchInput`

### Data Display Components (`src/components/data-display/`)
- `MetricValue`: Formatted Indian numbers and currency.
- `PercentageChange`: Color-coded change with direction arrows.
- `TrendIndicator`: Labeled status with colored indicator dots.
- `LoadingSkeleton`: Polished placeholder while data loads.
- `EmptyState`: Clean icon + message layout.

### Charts (`src/components/charts/`)
- `BaseAreaChart`: Area fill with gradient and optional benchmark line.
- `BaseLineChart`: Multi-line time series.
- `DivergingBarChart`: Signed positive/negative bars around a zero reference.
- `ComparisonChart`: Multi-series comparative performance.
- `SparklineChart`: Compact inline trend sparkline.
- `ChartTooltip`: Centralized financial tooltip formatter.

### Layout & Navigation (`src/components/shared/` & `src/components/layout/`)
- `PageContainer`: Standardized 1600px responsive canvas.
- `SectionHeader`: Section title with tooltip and action controls.
- `DashboardHeader`: Product title, active tabs, universe selector, and period switch.

---

## 8. Directory Architecture

```text
src/
├── app/
│   ├── (terminal)/
│   │   ├── page.jsx              # Flagship Market Breadth Dashboard
│   │   └── layout.tsx            # Terminal App Shell
│   ├── market-breadth/
│   │   └── page.jsx              # Standalone Market Breadth route
│   └── globals.css               # Centralized CSS variables & design tokens
├── components/
│   ├── ui/                       # Foundation atoms (Button, Card, Badge, etc.)
│   ├── data-display/             # Data visualization & metric formatters
│   ├── charts/                   # Centralized Recharts visualization library
│   ├── shared/                   # Layout containers & section headers
│   └── market-breadth/           # Feature components for Market Breadth
├── data/
│   ├── mockMarketBreadth.js      # Column 1, 2, 3 EOD market breadth data
│   ├── mockMarketInternals.js    # 6 Analytics cards internals data
│   └── mockIndices.js            # Bottom 7 benchmark indices data
├── lib/
│   ├── design-tokens.js          # Centralized tokens (colors, font, spacing)
│   ├── chart-theme.js            # Shared Recharts themes
│   ├── formatters.js             # Financial formatting utilities
│   └── constants.js              # Universes & period options
└── docs/
    └── DESIGN_SYSTEM.md          # This documentation
```
