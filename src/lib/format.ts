import { isAddress } from "viem";

import type { Address, Grant, GrantStatus, Milestone, MilestoneStatus, Summary } from "./domain";

type RawRecord = Record<string, unknown>;
const grantStatuses = new Set<GrantStatus>(["FUNDING", "ACTIVE", "COMPLETED", "EXPIRED"]);
const milestoneStatuses = new Set<MilestoneStatus>(["PENDING", "PROVISIONAL_APPROVAL", "PROVISIONAL_REJECTION", "REQUEST_MORE_INFO", "UNRESOLVED", "CHALLENGED", "UPHELD_APPROVAL", "UPHELD_REJECTION", "OVERTURNED_TO_APPROVAL", "OVERTURNED_TO_REJECTION", "PAID", "REFUNDED"]);

function record(value: unknown): RawRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("contract result must be an object");
  return value as RawRecord;
}
function text(raw: RawRecord, key: string): string {
  const value = raw[key];
  if (typeof value !== "string") throw new Error(`contract field ${key} must be a string`);
  return value;
}
function amount(raw: RawRecord, key: string): bigint {
  const value = raw[key];
  if (typeof value === "bigint" && value >= 0n) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  throw new Error(`contract field ${key} must be a non-negative bigint string`);
}
function flag(raw: RawRecord, key: string): boolean {
  const value = raw[key];
  if (typeof value !== "boolean") throw new Error(`contract field ${key} must be a boolean`);
  return value;
}
function address(raw: RawRecord, key: string): Address {
  const value = text(raw, key);
  if (!isAddress(value)) throw new Error(`contract field ${key} must be an address`);
  return value;
}
function status<T extends string>(raw: RawRecord, key: string, allowed: Set<T>, label: string): T {
  const value = text(raw, key);
  if (!allowed.has(value as T)) throw new Error(`unknown ${label} status: ${value}`);
  return value as T;
}

export function mapGrant(value: unknown): Grant {
  const raw = record(value);
  return { grantId: text(raw, "grant_id"), schemaVersion: amount(raw, "schema_version"), sponsor: address(raw, "sponsor"), beneficiary: address(raw, "beneficiary"), projectName: text(raw, "project_name"), organization: text(raw, "organization"), projectReference: text(raw, "project_reference"), region: text(raw, "region"), category: text(raw, "category"), description: text(raw, "description"), planHash: text(raw, "plan_hash"), escrowTarget: amount(raw, "escrow_target"), milestoneCount: amount(raw, "milestone_count"), evidencePolicyVersion: text(raw, "evidence_policy_version"), challengeBond: amount(raw, "challenge_bond"), challengeWindow: amount(raw, "challenge_window"), status: status(raw, "status", grantStatuses, "grant"), funded: amount(raw, "funded"), reserved: amount(raw, "reserved") };
}
export function mapMilestone(value: unknown): Milestone {
  const raw = record(value);
  return { grantId: text(raw, "grant_id"), index: amount(raw, "index"), title: text(raw, "title"), criteria: text(raw, "criteria"), allocation: amount(raw, "allocation"), deadline: amount(raw, "deadline"), evidenceRequirement: text(raw, "evidence_requirement"), minIndependentSources: amount(raw, "min_independent_sources"), criteriaHash: text(raw, "criteria_hash"), status: status(raw, "status", milestoneStatuses, "milestone"), submissionNonce: amount(raw, "submission_nonce"), evidencePackHash: text(raw, "evidence_pack_hash"), reservedAmount: amount(raw, "reserved_amount"), evidenceCount: amount(raw, "evidence_count"), challengeDeadline: amount(raw, "challenge_deadline"), challengeNonce: amount(raw, "challenge_nonce"), challengedDecisionNonce: amount(raw, "challenged_decision_nonce"), executionComplete: flag(raw, "execution_complete"), expired: flag(raw, "expired") };
}
export function mapSummary(value: unknown): Summary {
  const raw = record(value);
  return { grantInflows: amount(raw, "grant_inflows"), challengeCreditInflows: amount(raw, "challenge_credit_inflows"), available: amount(raw, "available"), reservedMilestoneEscrow: amount(raw, "reserved_milestone_escrow"), completedPayouts: amount(raw, "completed_payouts"), completedRefunds: amount(raw, "completed_refunds"), availableCredits: amount(raw, "available_credits"), reservedBonds: amount(raw, "reserved_bonds"), returnedBonds: amount(raw, "returned_bonds"), slashedBonds: amount(raw, "slashed_bonds") };
}
