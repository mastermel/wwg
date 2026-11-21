import type { ArmySummary, CampaignMemberResponse } from "@/api/generated/model";

/** A Player to offer as an army's commander, greyed out with why if they can't be. */
export interface CommanderOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Players who could command an army on `sideId` (decision 0036): every Player, but one who
 * commands an army of another side is greyed out, saying which. Those who command an army there
 * already say so. `armyId` is the army being given (its own commander doesn't count against it).
 */
export const commanderOptions = (
  members: readonly CampaignMemberResponse[],
  armies: readonly ArmySummary[],
  sideId: string,
  armyId?: string,
): CommanderOption[] =>
  members
    .filter((m) => m.role === "Player")
    .map((m) => {
      const name = `${m.firstName} ${m.lastName}`;
      const theirs = armies.filter((a) => a.commander?.memberId === m.id && a.id !== armyId);
      const enemy = theirs.find((a) => a.side.id !== sideId);
      if (enemy) {
        return {
          value: m.id,
          label: `${name} (commands ${enemy.name}, of the other side)`,
          disabled: true,
        };
      }
      return theirs.length > 0
        ? { value: m.id, label: `${name} (commands ${theirs.map((a) => a.name).join(", ")})` }
        : { value: m.id, label: name };
    });
