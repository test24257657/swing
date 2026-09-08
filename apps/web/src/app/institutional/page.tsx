import { PhaseStub } from "@/components/screen/phase-stub";
import { Screen, ScreenHeader } from "@/components/screen/screen-header";

export default function InstitutionalPage() {
  return (
    <Screen>
      <ScreenHeader
        title="Institutional Activity"
        subtitle="Who is accumulating, and whether the derivatives book agrees."
      />
      <PhaseStub
        phase="Phase 8 · institutional / F&O"
        contents={[
          "Bulk & block deals with repeat-accumulation flags (same client over 30 sessions)",
          "Participant-wise open interest — FII / DII / Pro / Client",
          "FII derivatives long/short ratio with stretched / capitulation bands",
        ]}
      />
    </Screen>
  );
}
