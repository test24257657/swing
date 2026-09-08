import { redirect } from "next/navigation";

export default function StockIndex() {
  // No symbol selected — send the user to the screener to pick one.
  redirect("/screener");
}
