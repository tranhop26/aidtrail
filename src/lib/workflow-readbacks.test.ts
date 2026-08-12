import { describe, expect, it } from "vitest";

import type { Grant, Milestone } from "./domain";
import { challengeReadback, creditReadback, evidenceReadback, expireGrantReadback, fundReadback, grantCreationReadback, listGrantSnapshot, settlementReadback } from "./workflow-readbacks";

const owner = "0x2222222222222222222222222222222222222222" as const;
const grant: Grant = { grantId: "ATG-2", schemaVersion: 1n, sponsor: owner, beneficiary: owner, projectName: "Water", organization: "Water Lab", projectReference: "https://example.com", region: "Mekong", category: "Water", description: "Test grant", planHash: "0xplan", escrowTarget: 100n, milestoneCount: 1n, evidencePolicyVersion: "v1", challengeBond: 5n, challengeWindow: 1n, funded: 40n, reserved: 0n, status: "FUNDING" };
const milestone: Milestone = { grantId: grant.grantId, index: 0n, title: "Build", criteria: "Build it", allocation: 100n, deadline: 1n, evidenceRequirement: "Public URL", minIndependentSources: 1n, criteriaHash: "0xcriteria", submissionNonce: 2n, evidencePackHash: "0xnew", status: "PROVISIONAL_APPROVAL", reservedAmount: 0n, evidenceCount: 1n, challengeDeadline: 1n, challengeNonce: 0n, challengedDecisionNonce: 0n, executionComplete: false, expired: false };
const contract = { listGrants: async () => ({ availability: "available" as const, data: [grant] }), readGrant: async () => ({ availability: "available" as const, data: grant }), readMilestone: async () => ({ availability: "available" as const, data: milestone }), readCredit: async () => ({ availability: "available" as const, data: 15n }) };
const grantTerms = (source: Grant) => ({ schemaVersion: source.schemaVersion, sponsor: source.sponsor, beneficiary: source.beneficiary, projectName: source.projectName, organization: source.organization, projectReference: source.projectReference, region: source.region, category: source.category, description: source.description, escrowTarget: source.escrowTarget, milestoneCount: source.milestoneCount, evidencePolicyVersion: source.evidencePolicyVersion, challengeBond: source.challengeBond, challengeWindow: source.challengeWindow });

describe("workflow readbacks", () => {
  it("proves a newly appended grant matches the signed terms", async () => expect(await grantCreationReadback(contract, new Set(["ATG-1"]), grantTerms(grant))()).toBe(true));
  it("paginates creation snapshots and readbacks past the contract's 50-grant cap", async () => {
    const grants = Array.from({ length: 51 }, (_, index) => ({ ...grant, grantId: `ATG-${index + 1}`, projectName: `Existing ${index + 1}` }));
    const created = { ...grant, grantId: "ATG-52", projectName: "New water terms", escrowTarget: 125n };
    const offsets: bigint[] = [];
    let afterCreation = false;
    const paged = { listGrants: async (offset: bigint) => { offsets.push(offset); return { availability: "available" as const, data: offset === 0n ? grants.slice(0, 50) : afterCreation ? [grants[50], created] : [grants[50]] }; } };

    await expect(listGrantSnapshot(paged)).resolves.toEqual(grants);
    afterCreation = true;
    await expect(grantCreationReadback(paged, new Set(grants.map((item) => item.grantId)), grantTerms(created))()).resolves.toBe(true);
    expect(offsets).toEqual([0n, 50n, 0n, 50n]);
  });
  it("rejects a new grant whose contract terms differ from the signed plan", async () => {
    const changed = { ...grant, grantId: "ATG-3", organization: "Different organization" };
    const after = { listGrants: async () => ({ availability: "available" as const, data: [grant, changed] }) };

    await expect(grantCreationReadback(after, new Set([grant.grantId]), grantTerms(grant))()).resolves.toBe(false);
  });
  it("proves funding changed funded amount or activated the grant", async () => expect(await fundReadback(contract, "ATG-2", 20n, "FUNDING")()).toBe(true));
  it("proves evidence advanced nonce and committed a hash", async () => expect(await evidenceReadback(contract, "ATG-2", 0n, 1n)()).toBe(true));
  it("proves a challenge left the original provisional decision", async () => expect(await challengeReadback(contract, "ATG-2", 0n, 0n, "PROVISIONAL_REJECTION")()).toBe(true));
  it("proves credit changed from its snapshot", async () => expect(await creditReadback(contract, owner, 10n)()).toBe(true));
  it("proves finalize or expiry executed the milestone consequence", async () => expect(await settlementReadback({ ...contract, readMilestone: async () => ({ availability: "available" as const, data: { ...milestone, executionComplete: true } }) }, "ATG-2", 0n, "finalize")()).toBe(true));
  it("reconciles expiry only when every snapshotted eligible milestone is refunded", async () => {
    const first = { ...milestone, index: 0n, status: "PENDING" as const, deadline: 10n };
    const second = { ...milestone, index: 1n, status: "REQUEST_MORE_INFO" as const, deadline: 20n };
    const reads: bigint[] = [];
    const expiring = { readMilestone: async (_grantId: string, index: bigint) => { reads.push(index); const before = index === 0n ? first : second; return { availability: "available" as const, data: { ...before, status: "REFUNDED" as const, executionComplete: true, expired: true } }; } };

    await expect(expireGrantReadback(expiring, "ATG-2", [first, second], 86_421n)()).resolves.toBe(true);
    expect(reads).toEqual([0n, 1n]);
  });
  it("does not reconcile unchanged contract state", async () => {
    await expect(evidenceReadback(contract, "ATG-2", 0n, 2n)()).resolves.toBe(false);
    await expect(challengeReadback(contract, "ATG-2", 0n, 0n, "PROVISIONAL_APPROVAL")()).resolves.toBe(false);
    await expect(creditReadback(contract, owner, 15n)()).resolves.toBe(false);
    await expect(settlementReadback(contract, "ATG-2", 0n, "finalize")()).resolves.toBe(false);
  });
});
