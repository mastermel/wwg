import { notifications } from "@mantine/notifications";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  getListArmyTurnsQueryKey,
  getListArmyTurnsQueryOptions,
  getListMarchesQueryKey,
  useGiveOrder,
  useHoldUnits,
  useMoveUnits,
  useSubmitTurn,
  useUndoOrder,
  useUndoOrders,
} from "@/api/generated/endpoints/turns/turns";
import type {
  ArmySummary,
  ArmyTurnDetails,
  GiveOrderRequest,
  MoveUnitsRequest,
} from "@/api/generated/model";
import { getGetSupplyQueryKey } from "@/api/generated/endpoints/supply/supply";
import { refreshCampaign } from "@/features/campaigns/campaign-cache";
import { errorMessage } from "@/lib/errors";

/** An army, its turn in the open campaign turn, and all its turns, newest first (once loaded). */
export interface OpenArmyTurn {
  army: ArmySummary;
  turn: ArmyTurnDetails | undefined;
  turns: readonly ArmyTurnDetails[];
}

/** The open turn of each army (those a commander commands; every one, for the Umpire). Online only. */
export function useOpenTurns(armies: readonly ArmySummary[]): OpenArmyTurn[] {
  const results = useQueries({
    queries: armies.map((army) =>
      getListArmyTurnsQueryOptions(army.id, { query: { meta: { persist: false } } }),
    ),
  });
  return armies.map((army, index) => ({
    army,
    turn: results[index]?.data?.find((turn) => turn.open),
    turns: results[index]?.data ?? [],
  }));
}

/**
 * A commander's changes to their army's turn: each confirms itself or says what went wrong, then
 * refreshes the campaign and the army's turns (keyed by the army, so `refreshCampaign` misses them).
 * Each resolves to whether it worked.
 */
export function useOrders(campaignId: string) {
  const queryClient = useQueryClient();
  const give = useGiveOrder();
  const undo = useUndoOrder();
  const undoMany = useUndoOrders();
  const hold = useHoldUnits();
  const move = useMoveUnits();
  const submit = useSubmitTurn();

  const run = async (
    armyId: string,
    change: () => Promise<unknown>,
    done: string,
    failed: string,
  ) => {
    try {
      await change();
      notifications.show({ color: "green", message: done });
      return true;
    } catch (error) {
      notifications.show({ color: "red", message: errorMessage(error, failed) });
      return false;
    } finally {
      await Promise.all([
        refreshCampaign(queryClient, campaignId),
        queryClient.invalidateQueries({ queryKey: getListArmyTurnsQueryKey(armyId) }),
        // What its units' orders cost in forced marches (step 47).
        queryClient.invalidateQueries({ queryKey: getListMarchesQueryKey(armyId) }),
        // Where its orders leave its units' supply (step 48).
        queryClient.invalidateQueries({ queryKey: getGetSupplyQueryKey(campaignId) }),
      ]);
    }
  };

  return {
    busy:
      give.isPending ||
      undo.isPending ||
      undoMany.isPending ||
      hold.isPending ||
      move.isPending ||
      submit.isPending,
    give: (
      armyId: string,
      turnId: string,
      unit: { id: string; name: string },
      order: GiveOrderRequest,
      done?: string,
    ) =>
      run(
        armyId,
        () => give.mutateAsync({ id: turnId, unitId: unit.id, data: order }),
        done ??
          (order.kind === "Hold"
            ? `${unit.name} will hold.`
            : order.kind === "Disembark"
              ? `${unit.name} will land.`
              : order.forceMarch
                ? `${unit.name} will force march.`
                : `${unit.name} will move.`),
        `${unit.name}'s order couldn't be saved. Try again.`,
      ),
    undo: (armyId: string, turnId: string, unit: { id: string; name: string }) =>
      run(
        armyId,
        () => undo.mutateAsync({ id: turnId, unitId: unit.id }),
        `Undid ${unit.name}'s order.`,
        `${unit.name}'s order couldn't be undone. Try again.`,
      ),
    /** Takes back several units' orders, a hex's stack (step 66g), in one request: all or none. */
    undoAll: (armyId: string, turnId: string, unitIds: string[]) =>
      run(
        armyId,
        () => undoMany.mutateAsync({ id: turnId, data: { unitIds } }),
        `Undid the ${String(unitIds.length)} units' orders.`,
        "The units' orders couldn't be undone. Try again.",
      ),
    /** Holds a formation's units without orders (step 64), in one request: all or none. */
    holdTheRest: (armyId: string, turnId: string, unitIds: string[], formation: string) =>
      run(
        armyId,
        () => hold.mutateAsync({ id: turnId, data: { unitIds } }),
        unitIds.length === 1
          ? `The last unit in ${formation} will hold.`
          : `The other ${String(unitIds.length)} units in ${formation} will hold.`,
        `The rest of ${formation} couldn't be told to hold. Try again.`,
      ),
    /** Holds a hex's units without orders, in one request: all or none. */
    holdAll: (armyId: string, turnId: string, unitIds: string[]) =>
      run(
        armyId,
        () => hold.mutateAsync({ id: turnId, data: { unitIds } }),
        `The ${String(unitIds.length)} units will hold.`,
        "The units couldn't be told to hold. Try again.",
      ),
    /** Moves a hex's units without orders together (step 66), in one request: all or none. */
    moveAll: (armyId: string, turnId: string, order: MoveUnitsRequest) =>
      run(
        armyId,
        () => move.mutateAsync({ id: turnId, data: order }),
        `The ${String(order.unitIds.length)} units will ${order.forceMarch ? "force march" : "move"} together.`,
        "The units couldn't be moved together. Try again.",
      ),
    submit: (armyId: string, turn: ArmyTurnDetails, armyName: string, note?: string) =>
      run(
        armyId,
        () => submit.mutateAsync({ id: turn.id, data: note ? { note } : null }),
        `Submitted ${armyName}'s turn ${String(turn.turn)}.`,
        `${armyName}'s turn couldn't be submitted. Try again.`,
      ),
  };
}

/** The Umpire's latest word on a Draft turn: why it was sent back or reopened, if it was. */
export function reviewOf(turn: ArmyTurnDetails) {
  const last = turn.history.at(-1);
  return turn.status === "Draft" && (last?.kind === "SentBack" || last?.kind === "Reverted")
    ? last
    : undefined;
}
