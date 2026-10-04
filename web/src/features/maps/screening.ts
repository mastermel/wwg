/** Runs of turns in a row, as "1–3", "5". */
const runs = (turns: readonly number[]) => {
  const sorted = [...new Set(turns)].sort((a, b) => a - b);
  const found: string[] = [];
  let start = sorted[0];
  for (let i = 0; i < sorted.length; i++) {
    const turn = sorted[i] ?? 0;
    const next = sorted[i + 1];
    if (next === turn + 1) continue;
    found.push(start === turn ? String(turn) : `${String(start)}–${String(turn)}`);
    start = next;
  }
  return found;
};

/**
 * The turns a unit closed screening (decision 0026), in words: "Turns 1–3 and 5", "Turn 4", or
 * null for none.
 */
export function describeScreeningTurns(turns: readonly number[]): string | null {
  const parts = runs(turns);
  if (parts.length === 0) return null;
  const last = parts.pop() ?? "";
  const listed = parts.length > 0 ? `${parts.join(", ")} and ${last}` : last;
  return `${listed.includes(" ") || listed.includes("–") ? "Turns" : "Turn"} ${listed}`;
}
