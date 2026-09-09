import { Activity, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Current scope is the Market Pulse screen only (docs/ARCHITECTURE.md §1).
 * Sector Rotation, Indices, Screener, Stock Detail, Watchlist, News and
 * Institutional return with their phases — the earlier implementations are in git
 * history at commit e499c2d if you need them back.
 */
export const NAV: NavItem[] = [{ href: "/pulse", label: "Market Pulse", icon: Activity }];
