"use client";

import { useState } from "react";

import type { Grant, Milestone } from "../../lib/domain";
import { useTransaction, TransactionStatus } from "../providers/transaction-provider";
import { useWallet } from "../providers/wallet-provider";
import { RoleActions } from "./role-actions";
import { FundGrantForm } from "../forms/fund-grant-form";
import { EvidenceForm } from "../forms/evidence-form";
import { ChallengeForm } from "../forms/challenge-form";

export function GrantActionArea({ grant, milestone }: { grant: Grant; milestone: Milestone }) {
  const wallet = useWallet();
  const transaction = useTransaction();
  const [active, setActive] = useState<"fund" | "submit_evidence" | "challenge" | undefined>();
  return <><RoleActions grant={grant} milestone={milestone} wallet={wallet} onAction={(action) => { if (action === "fund" || action === "submit_evidence" || action === "challenge") setActive(action); }} />{active === "fund" && <FundGrantForm grantId={grant.grantId} remaining={grant.escrowTarget - grant.funded} />}{active === "submit_evidence" && <EvidenceForm grant={grant} milestone={milestone} />}{active === "challenge" && <ChallengeForm grantId={grant.grantId} milestoneIndex={milestone.index} challengeBond={grant.challengeBond} />}{transaction.state.phase !== "awaiting_wallet" && <TransactionStatus state={transaction.state} />}</>;
}
