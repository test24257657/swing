import { Activity, Landmark, ListFilter, Newspaper, PieChart, Star, TrendingUp, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Scope is Market Pulse + Screener + Stock Detail + Watchlist + Sector Rotation +
 * Indices + News + Institutional (docs/ARCHITECTURE.md §1, phases 1-8) — every
 * screen in the build.
 */
export const NAV: NavItem[] = [
  { href: "/pulse", label: "Market Pulse", icon: Activity },
  { href: "/screener", label: "Screener", icon: ListFilter },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/sectors", label: "Sector Rotation", icon: PieChart },
  { href: "/indices", label: "Indices", icon: TrendingUp },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/institutional", label: "Institutional", icon: Landmark },
];
