"use client";

import { useState } from "react";

import { createAidTrailContract } from "../../lib/genlayer/contract";
import { createReadClient } from "../../lib/genlayer/read-client";
import { createWriteClient } from "../../lib/genlayer/write-client";
import { fundReadback } from "../../lib/workflow-readbacks";
import type { GrantStatus } from "../../lib/domain";
import { useTransaction, TransactionStatus } from "../providers/transaction-provider";
import { useWallet } from "../providers/wallet-provider";

export function FundGrantForm({ grantId, remaining, funded, status }: { grantId: string; remaining: bigint; funded: bigint; status: GrantStatus }) {
  const [amount, setAmount] = useState(remaining.toString()); const wallet = useWallet(); const transaction = useTransaction(); const valid = /^\d+$/.test(amount) && BigInt(amount) > 0n;
  const fund = async () => { if (!valid || wallet.status !== "connected" || !wallet.account || !wallet.provider) return; const client = await createWriteClient(wallet.provider, wallet.account); const contract = createAidTrailContract({ address: process.env.NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS, readClient: createReadClient(), writeClient: client }); await transaction.execute(() => contract.fundGrant({ grantId, amount: BigInt(amount), readback: fundReadback(contract, grantId, funded, status) })); };
  return <section className="compact-form"><h2>Fund this grant</h2><p>Only the sponsor can fund. Any amount above the remaining target becomes refundable contract credit.</p><label className="form-field"><span>Amount (GEN)</span><input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><p className="form-hint">Remaining target: {remaining.toString()} GEN.</p><button type="button" className="button" disabled={!valid || wallet.status !== "connected"} onClick={() => void fund()}>Sign funding transaction</button>{transaction.state.phase !== "awaiting_wallet" && <TransactionStatus state={transaction.state} />}</section>;
}
