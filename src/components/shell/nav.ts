import {
  LayoutDashboard,
  ScanLine,
  SlidersHorizontal,
  Compass,
  Landmark,
  BookmarkCheck,
  Shapes,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { href: "/",             label: "Dashboard",      icon: LayoutDashboard },
  { href: "/patterns",     label: "Chart Patterns", icon: Shapes },
  { href: "/scan",         label: "Scan Setups",    icon: ScanLine },
  { href: "/screener",     label: "Screener",       icon: SlidersHorizontal },
  { href: "/sectors",      label: "Sectors (RRG)",  icon: Compass },
  { href: "/institutional",label: "Smart Money",    icon: Landmark },
  { href: "/watchlist",    label: "Watchlist",      icon: BookmarkCheck },
];

