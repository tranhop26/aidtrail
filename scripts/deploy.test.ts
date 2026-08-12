import { describe, expect, it } from "vitest";

import { validateFinalizedDeployment } from "./deploy";

describe("validateFinalizedDeployment", () => {
  it("returns the deployed address only for finalized successful execution", () => {
    expect(validateFinalizedDeployment({
      statusName: "FINALIZED",
      txExecutionResultName: "FINISHED_WITH_RETURN",
      txDataDecoded: { type: "deploy", contractAddress: "0x1111111111111111111111111111111111111111" },
    })).toBe("0x1111111111111111111111111111111111111111");
  });

  it.each([
    [{ statusName: "ACCEPTED", txExecutionResultName: "FINISHED_WITH_RETURN" }, /not finalized/],
    [{ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_ERROR" }, /execution failed/],
    [{ statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN" }, /contract address/],
  ])("rejects incomplete deployment proof", (receipt, message) => {
    expect(() => validateFinalizedDeployment(receipt)).toThrow(message);
  });
});
