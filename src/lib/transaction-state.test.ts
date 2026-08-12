import { describe, expect, it } from "vitest";

import { finalizeWithReadback, initialTransactionState, reduceTransactionState } from "./transaction-state";

describe("transaction lifecycle", () => {
  it("does not mark FINALIZED execution error as success", () => {
    const state = reduceTransactionState(initialTransactionState, {
      type: "receipt", status: "FINALIZED", execution: "FINISHED_WITH_ERROR",
    });
    expect(state.phase).toBe("execution_error");
  });

  it("requires matching readback after successful execution", () => {
    const state = reduceTransactionState(initialTransactionState, {
      type: "receipt", status: "FINALIZED", execution: "FINISHED_WITH_RETURN",
    });
    expect(state.phase).toBe("verifying_readback");
  });

  it("only accepts a successful readback predicate", () => {
    const awaitingReadback = reduceTransactionState(initialTransactionState, {
      type: "receipt", status: "FINALIZED", execution: "FINISHED_WITH_RETURN",
    });
    expect(reduceTransactionState(awaitingReadback, { type: "readback", matches: false }).phase).toBe("readback_mismatch");
    expect(reduceTransactionState(awaitingReadback, { type: "readback", matches: true }).phase).toBe("success");
  });

  it("does not report success until the finalized receipt and readback both match", async () => {
    const state = await finalizeWithReadback(
      initialTransactionState,
      async () => ({ status: "FINALIZED", execution: "FINISHED_WITH_RETURN" }),
      async () => false,
    );

    expect(state.phase).toBe("readback_mismatch");
  });
});
