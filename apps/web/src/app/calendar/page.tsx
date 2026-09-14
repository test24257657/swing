import { screenMetadata } from "@/lib/seo";

import { ResultsCalendarClient } from "./results-calendar-client";

export const metadata = screenMetadata({
  title: "Results Calendar",
  description:
    "Upcoming quarterly result dates across the whole market, plus already-filed results AI judged genuinely good from the real NSE-filed figures.",
  path: "/calendar",
});

export default function CalendarPage() {
  return <ResultsCalendarClient />;
}
