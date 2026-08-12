"use client";

import type { Grant, Milestone } from "../../lib/domain";
import { useTransaction, TransactionStatus } from "../providers/transaction-provider";
import { useWallet } from "../providers/wallet-provider";
import { RoleActions } from "./role-actions";

export function GrantActionArea({ grant, milestone }: { grant: Grant; milestone: Milestone }) {
  const wallet = useWallet();
  const transaction = useTransaction();
  return <><RoleActions grant={grant} milestone={milestone} wallet={wallet} />{transaction.state.phase !== "awaiting_wallet" && <TransactionStatus state={transaction.state} />}</>;
}
