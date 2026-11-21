import type { CampaignMemberResponse } from "@/api/generated/model";

/**
 * Players who could command an army: those without one, plus the army's current commander. (The
 * API lets a Player command several armies of one side, decision 0036; step 71c offers them.)
 */
export const commanderOptions = (members: CampaignMemberResponse[], armyId?: string) =>
  members
    .filter(
      (m) =>
        m.role === "Player" && (m.armies.length === 0 || m.armies.some((a) => a.id === armyId)),
    )
    .map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}` }));
