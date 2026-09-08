import {
  Activity,
  Bell,
  Building2,
  CandlestickChart,
  Grid2x2,
  LayoutGrid,
  Newspaper,
  Radar,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Order and labels match the design's left rail. */
export const NAV: NavItem[] = [
  { href: "/pulse", label: "Market Pulse", icon: Activity },
  { href: "/sectors", label: "Sector Rotation", icon: Radar },
  { href: "/indices", label: "Indices", icon: Grid2x2 },
  { href: "/screener", label: "Screener", icon: LayoutGrid },
  { href: "/stock", label: "Stock Detail", icon: CandlestickChart },
  { href: "/watchlist", label: "Watchlist", icon: Bell },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/institutional", label: "Institutional", icon: Building2 },
];
