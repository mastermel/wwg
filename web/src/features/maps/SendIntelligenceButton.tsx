import { Button } from "@mantine/core";
import { IconSpy } from "@tabler/icons-react";
import { useState } from "react";
import { useListArmies } from "@/api/generated/endpoints/armies/armies";
import { useListTurns } from "@/api/generated/endpoints/turns/turns";
import { SendIntelligenceModal } from "@/features/maps/SendIntelligenceModal";
import { useOnline } from "@/lib/use-online";

const live = { query: { meta: { persist: false } } } as const;

/**
 * The Umpire's "Send intelligence" (step 70b, decision 0035): shown once the campaign is under way.
 * Show it to the Umpire and Admins only.
 */
export function SendIntelligenceButton({ campaignId, to }: { campaignId: string; to?: string }) {
  const online = useOnline();
  const turns = useListTurns(campaignId, live);
  const armies = useListArmies(campaignId, live);
  const [sending, setSending] = useState(false);
  if (turns.data?.stage !== "Running" || !armies.data) return null;

  return (
    <>
      <Button
        variant="default"
        leftSection={<IconSpy size={16} aria-hidden />}
        disabled={!online}
        onClick={() => {
          setSending(true);
        }}
      >
        Send intelligence
      </Button>
      {sending && (
        <SendIntelligenceModal
          campaignId={campaignId}
          openTurn={turns.data.openTurn}
          armies={armies.data}
          to={to}
          onClose={() => {
            setSending(false);
          }}
        />
      )}
    </>
  );
}
