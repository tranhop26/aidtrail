"use client";

import { useState } from "react";

import { createAidTrailContract } from "../../lib/genlayer/contract";
import { createWriteClient } from "../../lib/genlayer/write-client";
import { useTransaction, TransactionStatus } from "../providers/transaction-provider";
import { useWallet } from "../providers/wallet-provider";

export function CreditForm({ credit = 0n }: { credit?: bigint }) {
  const wallet = useWallet(); const transaction = useTransaction(); const [amount, setAmount] = useState("");
  const write = async (kind: "deposit" | "withdraw") => { if (wallet.status !== "connected" || !wallet.account || !wallet.provider || (kind === "deposit" && (!/^\d+$/.test(amount) || BigInt(amount) === 0n))) return; const client = await createWriteClient(wallet.provider, wallet.account); const contract = createAidTrailContract({ address: process.env.NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS, writeClient: client }); await transaction.execute(() => kind === "deposit" ? contract.depositChallengeCredit({ amount: BigInt(amount), readback: async () => true }) : contract.withdrawCredit({ readback: async () => true })); };
  return <section className="compact-form"><h2>Challenge credit</h2><p>Available refundable credit: <strong>{credit.toString()} GEN</strong></p><label className="form-field"><span>Deposit GEN</span><input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><div className="form-actions"><button type="button" className="button" disabled={wallet.status !== "connected"} onClick={() => void write("deposit")}>Deposit credit</button><button type="button" className="button button--quiet" disabled={wallet.status !== "connected" || credit === 0n} onClick={() => void write("withdraw")}>Withdraw credit</button></div>{transaction.state.phase !== "awaiting_wallet" && <TransactionStatus state={transaction.state} />}</section>;
}
