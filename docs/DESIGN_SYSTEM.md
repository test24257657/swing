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

## 3. Typography & Font System

### Font Families
- **Primary Interface Font:** `Inter` (`--font-sans`)
  - Used for all interface chrome, headings, badges, controls, tooltips, and body text.
- **Monospace / Code Font:** `JetBrains Mono` (`--font-mono`)
  - Used for code snippets, raw data inspect, and terminal badges.

### Font Weights
| Weight Name | Value | Usage |
|-------------|-------|-------|
| Regular | `400` | Explanatory paragraphs, subtitles, footnotes |
| Medium | `500` | Secondary labels, table text, inactive controls |
| Semibold | `600` | Status badges, indicator labels, active control states |
| Bold | `700` | Page title, card headers, big financial numbers |

### Typography Scale & Semantic Roles
| Role | Font Family | Size | Weight | Tracking | Line Height | Usage |
|------|-------------|------|--------|----------|-------------|-------|
| **Page Title** | Inter | `15px` | `700` (Bold) | `-0.02em` | `18px` | Top dashboard header brand |
| **Section Title** | Inter | `12px` | `700` (Bold) | `+0.04em` | `16px` | Uppercase section titles |
| **Card Header** | Inter | `13px` | `700` (Bold) | `-0.01em` | `18px` | Metric & chart card titles |
| **Metric Value** | Inter | `18px`–`24px` | `700` (Bold) | `-0.025em` | `24px` | Major numbers (`tabular-nums`) |
| **Label Caps** | Inter | `11px` | `600` (Semibold) | `+0.05em` | `14px` | Uppercase category pills |
| **Body / Note** | Inter | `11px`–`12px` | `400` (Regular) | `-0.01em` | `16px` | Indicator descriptions |
| **Footnote** | Inter | `10px` | `500` (Medium) | `0em` | `14px` | Timestamps, axis ticks, benchmarks |

### Tabular Figures Rule
All financial figures, prices, percentages, points, and counts **must** use `tabular-nums` (`.tnum`):
```css
.tabular-nums {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "cv01" 1, "cv02" 1;
}
```
This guarantees vertical digit alignment across tables, cards, and tooltips.

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
- `PageContainer`: Standardized 100% full-width responsive canvas.
- `SectionHeader`: Section title with tooltip and action controls.
- `DashboardHeader`: Product title, active tabs, universe selector, and period switch.
