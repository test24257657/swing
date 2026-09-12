import { screenMetadata } from "@/lib/seo";

import { SectorsClient } from "./sectors-client";

export const metadata = screenMetadata({
  title: "Sector Rotation",
  description:
    "Which NSE sectors are leading, improving, weakening or lagging — 1-month/3-month momentum ranking and a relative-rotation graph vs NIFTY 500.",
  path: "/sectors",
});

export default function SectorsPage() {
  return <SectorsClient />;
}
