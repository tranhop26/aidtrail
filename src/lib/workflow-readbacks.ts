import type { Address, GrantStatus, MilestoneStatus } from "./domain";
import type { Grant, Milestone } from "./domain";
import type { AidTrailContract } from "./genlayer/contract";

const available = <T>(result: { availability: string; data?: T }): T | undefined => result.availability === "available" ? result.data : undefined;
type WorkflowReadContract = Pick<AidTrailContract, "listGrants" | "readGrant" | "readMilestone" | "readCredit">;
export type GrantCreationTerms = Pick<Grant, "schemaVersion" | "sponsor" | "beneficiary" | "projectName" | "organization" | "projectReference" | "region" | "category" | "description" | "escrowTarget" | "milestoneCount" | "evidencePolicyVersion" | "challengeBond" | "challengeWindow">;
const grantPageSize = 50n;
const expirableStatuses = new Set<MilestoneStatus>(["PENDING", "REQUEST_MORE_INFO", "UNRESOLVED"]);
export const curePeriodSeconds = 86_400n;

export async function listGrantSnapshot(contract: Pick<WorkflowReadContract, "listGrants">): Promise<Grant[]> {
  const grants: Grant[] = [];
  for (let offset = 0n;; offset += grantPageSize) {
    const page = await contract.listGrants(offset, grantPageSize);
    if (page.availability !== "available") throw new Error(page.reason);
    grants.push(...page.data);
    if (page.data.length < Number(grantPageSize)) return grants;
  }
}

export function isExpiryEligible(milestone: Milestone, now: bigint): boolean {
  return !milestone.executionComplete && expirableStatuses.has(milestone.status) && now > milestone.deadline + curePeriodSeconds;
}

export async function expiryMilestoneSnapshot(contract: Pick<WorkflowReadContract, "readMilestone">, grantId: string, milestoneCount: bigint): Promise<Milestone[]> {
  const reads = await Promise.all(Array.from({ length: Number(milestoneCount) }, (_, index) => contract.readMilestone(grantId, BigInt(index))));
  return reads.map((result) => { if (result.availability !== "available") throw new Error(result.reason); return result.data; });
}

export function grantCreationReadback(contract: Pick<WorkflowReadContract, "listGrants">, beforeIds: Set<string>, expected: GrantCreationTerms) {
  return async () => { try { const grants = await listGrantSnapshot(contract); const created = grants.find((grant) => !beforeIds.has(grant.grantId)); return Boolean(created && created.schemaVersion === expected.schemaVersion && created.sponsor.toLowerCase() === expected.sponsor.toLowerCase() && created.beneficiary.toLowerCase() === expected.beneficiary.toLowerCase() && created.projectName === expected.projectName && created.organization === expected.organization && created.projectReference === expected.projectReference && created.region === expected.region && created.category === expected.category && created.description === expected.description && created.escrowTarget === expected.escrowTarget && created.milestoneCount === expected.milestoneCount && created.evidencePolicyVersion === expected.evidencePolicyVersion && created.challengeBond === expected.challengeBond && created.challengeWindow === expected.challengeWindow); } catch { return false; } };
}
export function fundReadback(contract: Pick<WorkflowReadContract, "readGrant">, grantId: string, fundedBefore: bigint, statusBefore: GrantStatus) { return async () => { const grant = available(await contract.readGrant(grantId)); return Boolean(grant && (grant.funded > fundedBefore || grant.status !== statusBefore)); }; }
export function evidenceReadback(contract: Pick<WorkflowReadContract, "readMilestone">, grantId: string, milestoneIndex: bigint, nonceBefore: bigint) { return async () => { const milestone = available(await contract.readMilestone(grantId, milestoneIndex)); return Boolean(milestone && milestone.submissionNonce > nonceBefore && milestone.evidencePackHash.length > 0); }; }
export function challengeReadback(contract: Pick<WorkflowReadContract, "readMilestone">, grantId: string, milestoneIndex: bigint, nonceBefore: bigint, statusBefore: MilestoneStatus) { return async () => { const milestone = available(await contract.readMilestone(grantId, milestoneIndex)); return Boolean(milestone && (milestone.challengeNonce > nonceBefore || milestone.status !== statusBefore)); }; }
export function creditReadback(contract: Pick<WorkflowReadContract, "readCredit">, owner: Address, creditBefore: bigint) { return async () => { const credit = available(await contract.readCredit(owner)); return credit !== undefined && credit !== creditBefore; }; }
export function settlementReadback(contract: Pick<WorkflowReadContract, "readMilestone">, grantId: string, milestoneIndex: bigint, kind: "finalize" | "expire") { return async () => { const milestone = available(await contract.readMilestone(grantId, milestoneIndex)); return Boolean(milestone && milestone.executionComplete && (kind === "finalize" || milestone.expired)); }; }
export function expireGrantReadback(contract: Pick<WorkflowReadContract, "readMilestone">, grantId: string, before: readonly Milestone[], now: bigint) {
  const candidates = before.filter((milestone) => isExpiryEligible(milestone, now));
  return async () => {
    if (candidates.length === 0) return false;
    const reads = await Promise.all(candidates.map((milestone) => contract.readMilestone(grantId, milestone.index)));
    return reads.every((result) => result.availability === "available" && result.data.executionComplete && result.data.expired && result.data.status === "REFUNDED");
  };
}
