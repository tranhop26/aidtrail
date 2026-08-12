export type Address = `0x${string}`;
export type TransactionHash = `0x${string}`;

export type GrantStatus = "FUNDING" | "ACTIVE" | "COMPLETED" | "EXPIRED";
export type MilestoneStatus =
  | "PENDING"
  | "PROVISIONAL_APPROVAL"
  | "PROVISIONAL_REJECTION"
  | "REQUEST_MORE_INFO"
  | "UNRESOLVED"
  | "CHALLENGED"
  | "UPHELD_APPROVAL"
  | "UPHELD_REJECTION"
  | "OVERTURNED_TO_APPROVAL"
  | "OVERTURNED_TO_REJECTION"
  | "PAID"
  | "REFUNDED";

export interface Grant {
  grantId: string;
  schemaVersion: bigint;
  sponsor: Address;
  beneficiary: Address;
  projectName: string;
  organization: string;
  projectReference: string;
  region: string;
  category: string;
  description: string;
  planHash: string;
  escrowTarget: bigint;
  milestoneCount: bigint;
  evidencePolicyVersion: string;
  challengeBond: bigint;
  challengeWindow: bigint;
  status: GrantStatus;
  funded: bigint;
  reserved: bigint;
}

export interface Milestone {
  grantId: string;
  index: bigint;
  title: string;
  criteria: string;
  allocation: bigint;
  deadline: bigint;
  evidenceRequirement: string;
  minIndependentSources: bigint;
  criteriaHash: string;
  status: MilestoneStatus;
  submissionNonce: bigint;
  evidencePackHash: string;
  reservedAmount: bigint;
  evidenceCount: bigint;
  challengeDeadline: bigint;
  challengeNonce: bigint;
  challengedDecisionNonce: bigint;
  executionComplete: boolean;
  expired: boolean;
}

export interface Summary {
  grantInflows: bigint;
  challengeCreditInflows: bigint;
  available: bigint;
  reservedMilestoneEscrow: bigint;
  completedPayouts: bigint;
  completedRefunds: bigint;
  availableCredits: bigint;
  reservedBonds: bigint;
  returnedBonds: bigint;
  slashedBonds: bigint;
}

export type ReadAvailability<T> = { availability: "available"; data: T } | { availability: "unavailable"; reason: string };
export type ReadbackPredicate = () => Promise<boolean>;
export interface SubmittedWrite { hash: TransactionHash; readback: ReadbackPredicate; }
