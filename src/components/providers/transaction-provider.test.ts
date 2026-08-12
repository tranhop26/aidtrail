import { describe, expect, it } from "vitest";

import { normalizeGenLayerReceipt } from "./transaction-provider";

describe("normalizeGenLayerReceipt", () => {
  it("maps the GenLayer SDK transaction fields", () => {
    expect(normalizeGenLayerReceipt({ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" })).toEqual({
      status: "FINALIZED",
      execution: "FINISHED_WITH_RETURN",
    });
  });

  it("keeps polling incomplete transactions", () => {
    expect(normalizeGenLayerReceipt({ statusName: "PENDING" })).toBeUndefined();
  });
});
