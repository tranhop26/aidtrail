import type { Address, GrantStatus, MilestoneStatus } from "./domain";
import type { AidTrailContract } from "./genlayer/contract";

const available = <T>(result: { availability: string; data?: T }): T | undefined => result.availability === "available" ? result.data : undefined;
type WorkflowReadContract = Pick<AidTrailContract, "listGrants" | "readGrant" | "readMilestone" | "readCredit">;

export function grantCreationReadback(contract: Pick<WorkflowReadContract, "listGrants">, beforeIds: Set<string>, expected: { beneficiary: Address; projectName: string; escrowTarget: bigint }) {
  return async () => { const grants = available(await contract.listGrants(0n, 100n)) ?? []; const created = grants.find((grant) => !beforeIds.has(grant.grantId)); return Boolean(created && created.beneficiary.toLowerCase() === expected.beneficiary.toLowerCase() && created.projectName === expected.projectName && created.escrowTarget === expected.escrowTarget); };
}
export function fundReadback(contract: Pick<WorkflowReadContract, "readGrant">, grantId: string, fundedBefore: bigint, statusBefore: GrantStatus) { return async () => { const grant = available(await contract.readGrant(grantId)); return Boolean(grant && (grant.funded > fundedBefore || grant.status !== statusBefore)); }; }
export function evidenceReadback(contract: Pick<WorkflowReadContract, "readMilestone">, grantId: string, milestoneIndex: bigint, nonceBefore: bigint) { return async () => { const milestone = available(await contract.readMilestone(grantId, milestoneIndex)); return Boolean(milestone && milestone.submissionNonce > nonceBefore && milestone.evidencePackHash.length > 0); }; }
export function challengeReadback(contract: Pick<WorkflowReadContract, "readMilestone">, grantId: string, milestoneIndex: bigint, nonceBefore: bigint, statusBefore: MilestoneStatus) { return async () => { const milestone = available(await contract.readMilestone(grantId, milestoneIndex)); return Boolean(milestone && (milestone.challengeNonce > nonceBefore || milestone.status !== statusBefore)); }; }
export function creditReadback(contract: Pick<WorkflowReadContract, "readCredit">, owner: Address, creditBefore: bigint) { return async () => { const credit = available(await contract.readCredit(owner)); return credit !== undefined && credit !== creditBefore; }; }
export function settlementReadback(contract: Pick<WorkflowReadContract, "readMilestone">, grantId: string, milestoneIndex: bigint, kind: "finalize" | "expire") { return async () => { const milestone = available(await contract.readMilestone(grantId, milestoneIndex)); return Boolean(milestone && milestone.executionComplete && (kind === "finalize" || milestone.expired)); }; }
