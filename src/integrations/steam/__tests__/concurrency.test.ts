import { describe, expect, it } from "vitest";
import { mapSettledWithConcurrency, mapWithConcurrency } from "../concurrency";

describe("Steam concurrency helpers", () => {
  it("maps values in input order while respecting the concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;

    const results = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return value * 10;
    });

    expect(results).toEqual([10, 20, 30, 40]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it("keeps settled result order when individual items fail", async () => {
    const results = await mapSettledWithConcurrency([1, 2, 3], 2, async (value) => {
      if (value === 2) {
        throw new Error("nope");
      }

      return value * 10;
    });

    expect(results[0]).toEqual({ status: "fulfilled", value: 10 });
    expect(results[1]).toMatchObject({ status: "rejected" });
    expect(results[2]).toEqual({ status: "fulfilled", value: 30 });
  });
});
