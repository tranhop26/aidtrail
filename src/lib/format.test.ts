import { describe, expect, it } from "vitest";

import { mapGrant, mapMilestone, mapSummary } from "./format";

describe("contract result mappers", () => {
  it("preserves large contract amounts as bigint", () => {
    const grant = mapGrant({
      grant_id: "ATG-1", schema_version: "1", sponsor: "0x1111111111111111111111111111111111111111", beneficiary: "0x2222222222222222222222222222222222222222",
      project_name: "Water", organization: "Aid", project_reference: "ref", region: "VN", category: "Water", description: "Clean water", plan_hash: "0xplan",
      escrow_target: "900719925474099312345", milestone_count: "1", evidence_policy_version: "v1", challenge_bond: "25", challenge_window: "86400", status: "FUNDING", funded: "0", reserved: "0",
    });

    expect(grant.escrowTarget).toBe(900719925474099312345n);
    expect(typeof grant.escrowTarget).toBe("bigint");
  });

  it("rejects unknown finite milestone states instead of silently displaying them", () => {
    expect(() => mapMilestone({
      grant_id: "ATG-1", index: "0", title: "Ship", criteria: "done", allocation: "10", deadline: "100", evidence_requirement: "report", min_independent_sources: "1", criteria_hash: "0xcriteria", status: "UNKNOWN", submission_nonce: "0", evidence_pack_hash: "", reserved_amount: "10", evidence_count: "0", challenge_deadline: "0", challenge_nonce: "0", challenged_decision_nonce: "0", execution_complete: false, expired: false,
    })).toThrow("unknown milestone status");
  });

  it("maps safe integer u256 values returned by the live SDK to bigint", () => {
    expect(mapSummary({
      grant_inflows: 0,
      challenge_credit_inflows: 1,
      available: 2,
      reserved_milestone_escrow: 3,
      completed_payouts: 4,
      completed_refunds: 5,
      available_credits: 6,
      reserved_bonds: 7,
      returned_bonds: 8,
      slashed_bonds: 9,
    })).toEqual({
      grantInflows: 0n,
      challengeCreditInflows: 1n,
      available: 2n,
      reservedMilestoneEscrow: 3n,
      completedPayouts: 4n,
      completedRefunds: 5n,
      availableCredits: 6n,
      reservedBonds: 7n,
      returnedBonds: 8n,
      slashedBonds: 9n,
    });
  });
});
