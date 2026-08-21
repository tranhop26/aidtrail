"use client";

import { useState } from "react";

import { createAidTrailContract } from "../../lib/genlayer/contract";
import { createReadClient } from "../../lib/genlayer/read-client";
import { createWriteClient } from "../../lib/genlayer/write-client";
import { challengeReadback } from "../../lib/workflow-readbacks";
import type { MilestoneStatus } from "../../lib/domain";
import { useTransaction, TransactionStatus } from "../providers/transaction-provider";
import { useWallet } from "../providers/wallet-provider";

export function ChallengeForm({ grantId, milestoneIndex, challengeBond, challengeNonce = 0n, status = "PROVISIONAL_APPROVAL", onReconciled }: { grantId: string; milestoneIndex: bigint; challengeBond: bigint; challengeNonce?: bigint; status?: MilestoneStatus; onReconciled?: () => void | Promise<void> }) {
  const wallet = useWallet(); const transaction = useTransaction(); const [counterEvidence, setCounterEvidence] = useState("");
  const submit = async () => { if (!counterEvidence.trim() || wallet.status !== "connected" || !wallet.account || !wallet.provider) return; const client = await createWriteClient(wallet.provider, wallet.account); const contract = createAidTrailContract({ address: process.env.NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS, readClient: createReadClient(), writeClient: client }); const result = await transaction.execute(() => contract.challengeMilestone({ grantId, milestoneIndex, counterEvidenceJson: counterEvidence, readback: challengeReadback(contract, grantId, milestoneIndex, challengeNonce, status) })); if (result.phase === "success" || result.phase === "readback_mismatch") await onReconciled?.(); };
  return <section className="workflow-card"><p className="eyebrow">Challenge a provisional decision</p><h2>Put {challengeBond.toString()} GEN challenge credit at stake.</h2><p>Your bond is returned if decision changes. It is credited to beneficiary if upheld. You must submit a counter-report and one independent source in the complete contract schema.</p><label className="form-field"><span>Canonical counter-evidence JSON</span><textarea value={counterEvidence} placeholder='{"action":"CHALLENGE_MILESTONE", ...}' onChange={(event) => setCounterEvidence(event.target.value)} /></label><p className="form-hint">The contract checks the original evidence hash, decision nonce, challenger address, replay marker, public URLs, integrity metadata, source independence, and freshness.</p><button type="button" className="button button--coral" disabled={!counterEvidence.trim() || wallet.status !== "connected"} onClick={() => void submit()}>Review and sign challenge</button>{transaction.state.phase !== "awaiting_wallet" && <TransactionStatus state={transaction.state} />}</section>;
}
