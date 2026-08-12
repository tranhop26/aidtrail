export type TransactionPhase = "awaiting_wallet" | "submitted" | "consensus" | "retryable" | "undetermined" | "execution_error" | "verifying_readback" | "readback_mismatch" | "success" | "rejected";
export type ConsensusStatus = "UNINITIALIZED" | "PENDING" | "PROPOSING" | "COMMITTING" | "REVEALING" | "ACCEPTED" | "UNDETERMINED" | "FINALIZED" | "CANCELED" | "APPEAL_REVEALING" | "APPEAL_COMMITTING" | "READY_TO_FINALIZE" | "VALIDATORS_TIMEOUT" | "LEADER_TIMEOUT";
export type ExecutionStatus = "NOT_VOTED" | "FINISHED_WITH_RETURN" | "FINISHED_WITH_ERROR";
export interface TransactionState { phase: TransactionPhase; hash?: `0x${string}`; status?: ConsensusStatus; error?: string; }
export type TransactionEvent = { type: "wallet_approved" } | { type: "submitted"; hash: `0x${string}` } | { type: "receipt"; status: ConsensusStatus; execution: ExecutionStatus } | { type: "timeout"; message?: string } | { type: "readback"; matches: boolean } | { type: "rejected"; message: string };
export const initialTransactionState: TransactionState = { phase: "awaiting_wallet" };

export function reduceTransactionState(state: TransactionState, event: TransactionEvent): TransactionState {
  if (event.type === "wallet_approved") return { ...state, phase: "submitted" };
  if (event.type === "submitted") return { phase: "submitted", hash: event.hash };
  if (event.type === "timeout") return { ...state, phase: "retryable", error: event.message };
  if (event.type === "rejected") return { ...state, phase: "rejected", error: event.message };
  if (event.type === "readback") return { ...state, phase: event.matches ? "success" : "readback_mismatch" };
  if (event.status === "FINALIZED") {
    if (event.execution === "FINISHED_WITH_RETURN") return { ...state, phase: "verifying_readback", status: event.status };
    if (event.execution === "FINISHED_WITH_ERROR") return { ...state, phase: "execution_error", status: event.status };
    return { ...state, phase: "undetermined", status: event.status };
  }
  if (event.status === "UNDETERMINED") return { ...state, phase: "undetermined", status: event.status };
  if (event.status === "VALIDATORS_TIMEOUT" || event.status === "LEADER_TIMEOUT") return { ...state, phase: "retryable", status: event.status };
  if (event.status === "CANCELED") return { ...state, phase: "rejected", status: event.status };
  return { ...state, phase: "consensus", status: event.status };
}

/** Poll a finalized receipt, then prove the intended state is readable before success. */
export async function finalizeWithReadback(
  state: TransactionState,
  waitForReceipt: () => Promise<{ status: ConsensusStatus; execution: ExecutionStatus }>,
  readback: () => Promise<boolean>,
): Promise<TransactionState> {
  try {
    const receipt = await waitForReceipt();
    const afterReceipt = reduceTransactionState(state, { type: "receipt", ...receipt });
    if (afterReceipt.phase !== "verifying_readback") return afterReceipt;
    return reduceTransactionState(afterReceipt, { type: "readback", matches: await readback() });
  } catch (error) {
    return reduceTransactionState(state, { type: "timeout", message: error instanceof Error ? error.message : "receipt polling failed" });
  }
}
