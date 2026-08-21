"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Address, Grant, Milestone } from "../../lib/domain";
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
  const accountRef = useRef(wallet.account);
  const creditRequestRef = useRef(0);
  const challengeCredit = wallet.status === "connected" && wallet.account === creditRead.account ? creditRead.value : 0n;
  useEffect(() => { accountRef.current = wallet.account; }, [wallet.account]);
  useEffect(() => {
    const updateNow = () => setNow(Math.floor(Date.now() / 1000));
    updateNow();
    const timer = window.setInterval(updateNow, 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const readCreditValue = useCallback(async (account: Address) => {
    const contract = createAidTrailContract({ address: process.env.NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS, readClient: createReadClient() });
    try {
      const result = await contract.readCredit(account);
      return result.availability === "available" ? result.data : 0n;
    } catch { return 0n; }
  }, []);
  const refreshCredit = useCallback(async (account: Address) => {
    const request = ++creditRequestRef.current;
    const value = await readCreditValue(account);
    if (request !== creditRequestRef.current || accountRef.current !== account) return undefined;
    setCreditRead({ account, value });
    return value;
  }, [readCreditValue]);
  useEffect(() => {
    if (wallet.status !== "connected" || !wallet.account) { creditRequestRef.current += 1; return; }
    const account = wallet.account;
    const request = ++creditRequestRef.current;
    void readCreditValue(account).then((value) => {
      if (request === creditRequestRef.current && accountRef.current === account) setCreditRead({ account, value });
    });
  }, [readCreditValue, wallet.account, wallet.status]);
  const act = async (action: Parameters<NonNullable<React.ComponentProps<typeof RoleActions>["onAction"]>>[0]) => {
    if (action === "fund") return setActive("fund");
    if (action === "submit_evidence" || action === "submit_cure") return setActive("submit_evidence");
    if (action === "challenge") return setActive("challenge");
    if (wallet.status !== "connected" || !wallet.account || !wallet.provider) return;
    const writeClient = await createWriteClient(wallet.provider, wallet.account); const contract = createAidTrailContract({ address: process.env.NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS, readClient: createReadClient(), writeClient });
    if (action === "finalize") await transaction.execute(() => contract.finalizeMilestone({ grantId: grant.grantId, milestoneIndex: milestone.index, readback: settlementReadback(contract, grant.grantId, milestone.index, "finalize") }));
    if (action === "expire") { const submittedAt = BigInt(Math.floor(Date.now() / 1000)); const before = await expiryMilestoneSnapshot(contract, grant.grantId, grant.milestoneCount); await transaction.execute(() => contract.expireGrant({ grantId: grant.grantId, readback: expireGrantReadback(contract, grant.grantId, before, submittedAt) })); }
    if (action === "withdraw_credit") { const account = wallet.account; const before = await refreshCredit(account); if (before === undefined || before === 0n) return; const result = await transaction.execute(() => contract.withdrawCredit({ readback: creditReadback(contract, account, before) })); if (result.phase === "success" || result.phase === "readback_mismatch") await refreshCredit(account); }
  };
  return <><RoleActions grant={grant} milestone={milestone} milestones={milestones} wallet={wallet} now={now} challengeCredit={challengeCredit} onAction={(action) => void act(action)} />{active === "fund" && <FundGrantForm grantId={grant.grantId} remaining={grant.escrowTarget - grant.funded} funded={grant.funded} status={grant.status} />}{active === "submit_evidence" && <EvidenceForm key={`${grant.grantId}:${milestone.index}:${milestone.minIndependentSources}`} grant={grant} milestone={milestone} />}{active === "challenge" && <ChallengeForm grantId={grant.grantId} milestoneIndex={milestone.index} challengeBond={grant.challengeBond} challengeNonce={milestone.challengeNonce} status={milestone.status} onReconciled={async () => { await refreshCredit(wallet.account!); }} />}{transaction.state.phase !== "awaiting_wallet" && <TransactionStatus state={transaction.state} />}</>;
}
