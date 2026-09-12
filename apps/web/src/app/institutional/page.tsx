import { screenMetadata } from "@/lib/seo";

import { InstitutionalClient } from "./institutional-client";

export const metadata = screenMetadata({
  title: "Institutional Activity",
  description:
    "Bulk and block deal disclosures with a repeat-accumulation flag, and participant-wise open interest including the FII index-futures long/short ratio.",
  path: "/institutional",
});

export default function InstitutionalPage() {
  return <InstitutionalClient />;
}
