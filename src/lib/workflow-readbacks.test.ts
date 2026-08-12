import { describe, expect, it } from "vitest";

import type { Grant, Milestone } from "./domain";
import { challengeReadback, creditReadback, evidenceReadback, fundReadback, grantCreationReadback, settlementReadback } from "./workflow-readbacks";

const owner = "0x2222222222222222222222222222222222222222" as const;
const grant: Grant = { grantId: "ATG-2", schemaVersion: 1n, sponsor: owner, beneficiary: owner, projectName: "Water", organization: "Water Lab", projectReference: "https://example.com", region: "Mekong", category: "Water", description: "Test grant", planHash: "0xplan", escrowTarget: 100n, milestoneCount: 1n, evidencePolicyVersion: "v1", challengeBond: 5n, challengeWindow: 1n, funded: 40n, reserved: 0n, status: "FUNDING" };
const milestone: Milestone = { grantId: grant.grantId, index: 0n, title: "Build", criteria: "Build it", allocation: 100n, deadline: 1n, evidenceRequirement: "Public URL", minIndependentSources: 1n, criteriaHash: "0xcriteria", submissionNonce: 2n, evidencePackHash: "0xnew", status: "PROVISIONAL_APPROVAL", reservedAmount: 0n, evidenceCount: 1n, challengeDeadline: 1n, challengeNonce: 0n, challengedDecisionNonce: 0n, executionComplete: false, expired: false };
const contract = { listGrants: async () => ({ availability: "available" as const, data: [grant] }), readGrant: async () => ({ availability: "available" as const, data: grant }), readMilestone: async () => ({ availability: "available" as const, data: milestone }), readCredit: async () => ({ availability: "available" as const, data: 15n }) };

describe("workflow readbacks", () => {
  it("proves a newly appended grant matches the signed identity and economics", async () => expect(await grantCreationReadback(contract, new Set(["ATG-1"]), { beneficiary: owner, projectName: "Water", escrowTarget: 100n })()).toBe(true));
  it("proves funding changed funded amount or activated the grant", async () => expect(await fundReadback(contract, "ATG-2", 20n, "FUNDING")()).toBe(true));
  it("proves evidence advanced nonce and committed a hash", async () => expect(await evidenceReadback(contract, "ATG-2", 0n, 1n)()).toBe(true));
  it("proves a challenge left the original provisional decision", async () => expect(await challengeReadback(contract, "ATG-2", 0n, 0n, "PROVISIONAL_REJECTION")()).toBe(true));
  it("proves credit changed from its snapshot", async () => expect(await creditReadback(contract, owner, 10n)()).toBe(true));
  it("proves finalize or expiry executed the milestone consequence", async () => expect(await settlementReadback({ ...contract, readMilestone: async () => ({ availability: "available" as const, data: { ...milestone, executionComplete: true } }) }, "ATG-2", 0n, "finalize")()).toBe(true));
  it("does not reconcile unchanged contract state", async () => {
    await expect(evidenceReadback(contract, "ATG-2", 0n, 2n)()).resolves.toBe(false);
    await expect(challengeReadback(contract, "ATG-2", 0n, 0n, "PROVISIONAL_APPROVAL")()).resolves.toBe(false);
    await expect(creditReadback(contract, owner, 15n)()).resolves.toBe(false);
    await expect(settlementReadback(contract, "ATG-2", 0n, "finalize")()).resolves.toBe(false);
  });
});
