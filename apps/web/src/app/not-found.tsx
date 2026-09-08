import Link from "next/link";

import { Button, EmptyState } from "@/components/ui";
import { Screen } from "@/components/screen/screen-header";

export default function NotFound() {
  return (
    <Screen>
      <EmptyState
        title="Page not found"
        description="That route does not exist."
        actions={
          <Link href="/pulse">
            <Button>Go to Market Pulse</Button>
          </Link>
        }
      />
    </Screen>
  );
}
