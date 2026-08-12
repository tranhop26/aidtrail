"use client";

import type { Grant, Milestone } from "../../lib/domain";
import { isExpiryEligible } from "../../lib/workflow-readbacks";

export type WalletForActions = {
  status: "disconnected" | "connecting" | "connected" | "wrong_network" | "rejected" | "unavailable";
  account?: string;
};

export type GrantAction = "fund" | "withdraw_credit" | "submit_evidence" | "submit_cure" | "challenge" | "finalize" | "expire";

export interface RoleActionsProps {
  grant: Grant;
  milestone: Milestone;
  milestones?: readonly Milestone[];
  wallet: WalletForActions;
  now?: number;
  challengeCredit?: bigint;
  onAction?: (action: GrantAction) => void;
}

const sameAddress = (left: string | undefined, right: string) => left?.toLowerCase() === right.toLowerCase();
const finalizable = new Set<Milestone["status"]>(["PROVISIONAL_APPROVAL", "PROVISIONAL_REJECTION", "UPHELD_APPROVAL", "UPHELD_REJECTION", "OVERTURNED_TO_APPROVAL", "OVERTURNED_TO_REJECTION"]);
const approval = new Set<Milestone["status"]>(["PROVISIONAL_APPROVAL", "UPHELD_APPROVAL", "OVERTURNED_TO_APPROVAL"]);

function ActionButton({ label, reason, onClick }: { label: string; reason?: string; onClick?: () => void }) {
  return <div className="role-action"><button type="button" className="button" disabled={Boolean(reason)} title={reason} onClick={onClick}>{label}</button>{reason && <p className="role-action__reason">{reason}</p>}</div>;
}

export function RoleActions({ grant, milestone, milestones = [milestone], wallet, now = 0, challengeCredit = 0n, onAction }: RoleActionsProps) {
  const connected = wallet.status === "connected" && Boolean(wallet.account);
  const sponsor = sameAddress(wallet.account, grant.sponsor);
  const beneficiary = sameAddress(wallet.account, grant.beneficiary);
  const call = (action: GrantAction) => () => onAction?.(action);
  const needsWallet = connected ? undefined : "Connect an injected wallet on Studionet to continue.";
  const challengeOpen = milestone.challengeDeadline > 0n && BigInt(now) < milestone.challengeDeadline;
  const canFinalize = finalizable.has(milestone.status) && milestone.challengeDeadline > 0n && BigInt(now) >= milestone.challengeDeadline && !milestone.executionComplete;
  const canExpire = grant.status === "ACTIVE" && milestones.some((item) => isExpiryEligible(item, BigInt(now)));

  return <section className="role-actions" aria-label="Available contract actions">
    <h2>Contract actions</h2>
    <p>Actions are submitted by your wallet and only complete after finalized execution and contract readback.</p>
    <div className="role-actions__grid">
      {sponsor && <ActionButton label="Fund grant" reason={grant.status === "FUNDING" ? needsWallet : "Funding is only available while the grant is in FUNDING state."} onClick={call("fund")} />}
      {sponsor && <ActionButton label="Withdraw refundable credit" reason={grant.status === "EXPIRED" || grant.status === "COMPLETED" ? needsWallet : "Refundable credit is available only after the grant is completed or expired."} onClick={call("withdraw_credit")} />}
      {beneficiary && milestone.status === "PENDING" && <ActionButton label="Submit evidence" reason={needsWallet} onClick={call("submit_evidence")} />}
      {beneficiary && milestone.status === "REQUEST_MORE_INFO" && <ActionButton label="Submit cure evidence" reason={needsWallet} onClick={call("submit_cure")} />}
      {connected && (milestone.status === "PROVISIONAL_APPROVAL" || milestone.status === "PROVISIONAL_REJECTION") && <ActionButton label="Challenge decision" reason={!challengeOpen ? "The challenge window has closed." : challengeCredit >= grant.challengeBond ? undefined : `A challenge credit of ${grant.challengeBond.toString()} GEN is required.`} onClick={call("challenge")} />}
      {connected && finalizable.has(milestone.status) && <ActionButton label={approval.has(milestone.status) ? "Finalize payout" : "Finalize refund"} reason={canFinalize ? undefined : milestone.executionComplete ? "This milestone has already been settled." : "The challenge window must close before anyone can finalize this decision."} onClick={call("finalize")} />}
      {connected && grant.status === "ACTIVE" && <ActionButton label="Expire grant" reason={canExpire ? undefined : milestone.executionComplete ? "This milestone has already been settled." : "The active milestone deadline must pass before anyone can expire the grant."} onClick={call("expire")} />}
    </div>
  </section>;
}
