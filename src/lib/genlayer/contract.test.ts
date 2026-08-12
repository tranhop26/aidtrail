import { describe, expect, it } from "vitest";

import { createAidTrailContract } from "./contract";

describe("AidTrail contract facade", () => {
  it("keeps reads visibly unavailable when no deployed address is configured", async () => {
    const contract = createAidTrailContract({ address: undefined, readClient: { readContract: async () => ({}) } });

    await expect(contract.readGrant("ATG-1")).resolves.toEqual({ availability: "unavailable", reason: "AidTrail contract address is not configured" });
  });

  it("refuses writes without a valid deployed address", async () => {
    const contract = createAidTrailContract({ address: "0xnot-an-address", writeClient: { connect: async () => undefined, writeContract: async () => "0xabc" } });

    await expect(contract.withdrawCredit({ readback: async () => true })).rejects.toThrow("AidTrail contract address is not configured");
  });
});
