import { describe, expect, it } from "vitest";
import { describeScreeningTurns } from "@/features/maps/screening";

describe("the turns a unit screened", () => {
  it("is nothing for none", () => {
    expect(describeScreeningTurns([])).toBeNull();
  });

  it("names a single turn", () => {
    expect(describeScreeningTurns([4])).toBe("Turn 4");
  });

  it("runs turns in a row together, in order", () => {
    expect(describeScreeningTurns([5, 1, 2, 3])).toBe("Turns 1–3 and 5");
    expect(describeScreeningTurns([2, 3])).toBe("Turns 2–3");
    expect(describeScreeningTurns([1, 4, 7])).toBe("Turns 1, 4 and 7");
  });
});
