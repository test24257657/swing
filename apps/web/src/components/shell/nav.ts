import { Activity, ListFilter, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Scope is Market Pulse + Screener (docs/ARCHITECTURE.md §1, phase 2). Sector
 * Rotation, Indices, Stock Detail, Watchlist, News and Institutional return with
 * their phases — the earlier implementations are in git history at commit e499c2d
 * if you need them back.
 */
export const NAV: NavItem[] = [
  { href: "/pulse", label: "Market Pulse", icon: Activity },
  { href: "/screener", label: "Screener", icon: ListFilter },
];
