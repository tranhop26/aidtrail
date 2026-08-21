"use client";

import { useEffect, useState } from "react";

import type { Grant, Milestone } from "../../lib/domain";
import { useTransaction, TransactionStatus } from "../providers/transaction-provider";
import { useWallet } from "../providers/wallet-provider";
import { RoleActions } from "./role-actions";
import { FundGrantForm } from "../forms/fund-grant-form";
import { EvidenceForm } from "../forms/evidence-form";
import { ChallengeForm } from "../forms/challenge-form";
import { createAidTrailContract } from "../../lib/genlayer/contract";
import { createReadClient } from "../../lib/genlayer/read-client";
import { createWriteClient } from "../../lib/genlayer/write-client";
import { creditReadback, expireGrantReadback, expiryMilestoneSnapshot, settlementReadback } from "../../lib/workflow-readbacks";

export function GrantActionArea({ grant, milestone, milestones }: { grant: Grant; milestone: Milestone; milestones: readonly Milestone[] }) {
  const wallet = useWallet();
  const transaction = useTransaction();
  const [active, setActive] = useState<"fund" | "submit_evidence" | "challenge" | undefined>();
  const [creditRead, setCreditRead] = useState<{ account?: string; value: bigint }>({ value: 0n });
  const [now, setNow] = useState(0);
  const challengeCredit = wallet.status === "connected" && wallet.account === creditRead.account ? creditRead.value : 0n;
  useEffect(() => {
    const updateNow = () => setNow(Math.floor(Date.now() / 1000));
    updateNow();
    const timer = window.setInterval(updateNow, 1_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let current = true;
    if (wallet.status !== "connected" || !wallet.account) return () => { current = false; };
    const account = wallet.account;
    const contract = createAidTrailContract({ address: process.env.NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS, readClient: createReadClient() });
    void contract.readCredit(account).then((result) => {
      if (current) setCreditRead({ account, value: result.availability === "available" ? result.data : 0n });
    }).catch(() => { if (current) setCreditRead({ account, value: 0n }); });
    return () => { current = false; };
  }, [wallet.account, wallet.status]);
  const act = async (action: Parameters<NonNullable<React.ComponentProps<typeof RoleActions>["onAction"]>>[0]) => {
    if (action === "fund") return setActive("fund");
    if (action === "submit_evidence" || action === "submit_cure") return setActive("submit_evidence");
    if (action === "challenge") return setActive("challenge");
    if (wallet.status !== "connected" || !wallet.account || !wallet.provider) return;
    const writeClient = await createWriteClient(wallet.provider, wallet.account); const contract = createAidTrailContract({ address: process.env.NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS, readClient: createReadClient(), writeClient });
    if (action === "finalize") await transaction.execute(() => contract.finalizeMilestone({ grantId: grant.grantId, milestoneIndex: milestone.index, readback: settlementReadback(contract, grant.grantId, milestone.index, "finalize") }));
    if (action === "expire") { const submittedAt = BigInt(Math.floor(Date.now() / 1000)); const before = await expiryMilestoneSnapshot(contract, grant.grantId, grant.milestoneCount); await transaction.execute(() => contract.expireGrant({ grantId: grant.grantId, readback: expireGrantReadback(contract, grant.grantId, before, submittedAt) })); }
    if (action === "withdraw_credit") { const before = await contract.readCredit(wallet.account); if (before.availability !== "available") throw new Error(before.reason); await transaction.execute(() => contract.withdrawCredit({ readback: creditReadback(contract, wallet.account!, before.data) })); }
  };
  return <><RoleActions grant={grant} milestone={milestone} milestones={milestones} wallet={wallet} now={now} challengeCredit={challengeCredit} onAction={(action) => void act(action)} />{active === "fund" && <FundGrantForm grantId={grant.grantId} remaining={grant.escrowTarget - grant.funded} funded={grant.funded} status={grant.status} />}{active === "submit_evidence" && <EvidenceForm grant={grant} milestone={milestone} />}{active === "challenge" && <ChallengeForm grantId={grant.grantId} milestoneIndex={milestone.index} challengeBond={grant.challengeBond} challengeNonce={milestone.challengeNonce} status={milestone.status} />}{transaction.state.phase !== "awaiting_wallet" && <TransactionStatus state={transaction.state} />}</>;
}
