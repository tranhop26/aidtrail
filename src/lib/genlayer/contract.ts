import type { Address, Grant, Milestone, ReadAvailability, ReadbackPredicate, SubmittedWrite, Summary } from "../domain";
import { mapGrant, mapMilestone, mapSummary } from "../format";
import { missingContractAddressMessage, requireAidTrailAddress } from "./config";
import { aidTrailMethod } from "./schema";
import type { ReadClient } from "./read-client";
import type { WriteClient } from "./write-client";

export interface ReadbackInput { readback: ReadbackPredicate; }
export interface CreateGrantInput extends ReadbackInput {
  beneficiary: Address; projectName: string; organization: string; projectReference: string; region: string; category: string; description: string;
  escrowTarget: bigint; milestoneTitles: string[]; milestoneCriteria: string[]; allocations: bigint[]; deadlines: bigint[]; evidenceRequirements: string[]; minIndependentSources: bigint[];
  evidencePolicyVersion: string; challengeBond: bigint; challengeWindow: bigint; schemaVersion: bigint;
}
export interface FundGrantInput extends ReadbackInput { grantId: string; amount: bigint; }
export interface MilestoneInput extends ReadbackInput { grantId: string; milestoneIndex: bigint; }
export interface SubmitEvidenceInput extends MilestoneInput { evidenceJson: string; }
export interface ChallengeMilestoneInput extends MilestoneInput { counterEvidenceJson: string; }
export interface DepositChallengeCreditInput extends ReadbackInput { amount: bigint; }

export interface AidTrailContract {
  readGrant(grantId: string): Promise<ReadAvailability<Grant>>;
  listGrants(offset: bigint, limit: bigint): Promise<ReadAvailability<Grant[]>>;
  readMilestone(grantId: string, milestoneIndex: bigint): Promise<ReadAvailability<Milestone>>;
  readSummary(): Promise<ReadAvailability<Summary>>;
  readCredit(owner: Address): Promise<ReadAvailability<bigint>>;
  createGrant(input: CreateGrantInput): Promise<SubmittedWrite>;
  fundGrant(input: FundGrantInput): Promise<SubmittedWrite>;
  submitEvidence(input: SubmitEvidenceInput): Promise<SubmittedWrite>;
  challengeMilestone(input: ChallengeMilestoneInput): Promise<SubmittedWrite>;
  finalizeMilestone(input: MilestoneInput): Promise<SubmittedWrite>;
  expireGrant(input: Omit<MilestoneInput, "milestoneIndex">): Promise<SubmittedWrite>;
  depositChallengeCredit(input: DepositChallengeCreditInput): Promise<SubmittedWrite>;
  withdrawCredit(input: ReadbackInput): Promise<SubmittedWrite>;
}

interface ContractOptions { address?: string; readClient?: ReadClient; writeClient?: WriteClient; }
function unavailable<T>(reason = missingContractAddressMessage): ReadAvailability<T> { return { availability: "unavailable", reason }; }
function available<T>(data: T): ReadAvailability<T> { return { availability: "available", data }; }

export function createAidTrailContract(options: ContractOptions): AidTrailContract {
  const address = options.address;
  const read = async <T>(functionName: string, args: unknown[], mapper: (raw: unknown) => T): Promise<ReadAvailability<T>> => {
    const configuredAddress = address === undefined ? undefined : (() => { try { return requireAidTrailAddress(address); } catch { return undefined; } })();
    if (!configuredAddress) return unavailable();
    if (!options.readClient) return unavailable("AidTrail read client is unavailable");
    return available(mapper(await options.readClient.readContract({ address: configuredAddress, functionName, args })));
  };
  const submit = async (functionName: string, args: unknown[], value: bigint, readback: ReadbackPredicate): Promise<SubmittedWrite> => {
    const configuredAddress = requireAidTrailAddress(address);
    if (!options.writeClient) throw new Error("AidTrail write client is unavailable");
    return { hash: await options.writeClient.writeContract({ address: configuredAddress, functionName, args, value }), readback };
  };

  return {
    readGrant: (grantId) => read(aidTrailMethod.getGrant, [grantId], mapGrant),
    listGrants: async (offset, limit) => read(aidTrailMethod.listGrants, [offset, limit], (raw) => {
      if (!Array.isArray(raw)) throw new Error("contract list_grants result must be an array");
      return raw.map(mapGrant);
    }),
    readMilestone: (grantId, milestoneIndex) => read(aidTrailMethod.getMilestone, [grantId, milestoneIndex], mapMilestone),
    readSummary: () => read(aidTrailMethod.getSummary, [], mapSummary),
    readCredit: (owner) => read(aidTrailMethod.getCredit, [owner], (raw) => {
      if (typeof raw === "bigint") return raw;
      if (typeof raw === "string" && /^\d+$/.test(raw)) return BigInt(raw);
      throw new Error("contract get_credit result must be a non-negative bigint string");
    }),
    createGrant: (input) => submit(aidTrailMethod.createGrant, [input.beneficiary, input.projectName, input.organization, input.projectReference, input.region, input.category, input.description, input.escrowTarget, input.milestoneTitles, input.milestoneCriteria, input.allocations, input.deadlines, input.evidenceRequirements, input.minIndependentSources, input.evidencePolicyVersion, input.challengeBond, input.challengeWindow, input.schemaVersion], 0n, input.readback),
    fundGrant: (input) => submit(aidTrailMethod.fundGrant, [input.grantId], input.amount, input.readback),
    submitEvidence: (input) => submit(aidTrailMethod.submitEvidence, [input.grantId, input.milestoneIndex, input.evidenceJson], 0n, input.readback),
    challengeMilestone: (input) => submit(aidTrailMethod.challengeMilestone, [input.grantId, input.milestoneIndex, input.counterEvidenceJson], 0n, input.readback),
    finalizeMilestone: (input) => submit(aidTrailMethod.finalizeMilestone, [input.grantId, input.milestoneIndex], 0n, input.readback),
    expireGrant: (input) => submit(aidTrailMethod.expireGrant, [input.grantId], 0n, input.readback),
    depositChallengeCredit: (input) => submit(aidTrailMethod.depositChallengeCredit, [], input.amount, input.readback),
    withdrawCredit: (input) => submit(aidTrailMethod.withdrawCredit, [], 0n, input.readback),
  };
}
