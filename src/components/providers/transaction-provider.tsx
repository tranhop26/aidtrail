"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useReducer } from "react";

import type { SubmittedWrite, TransactionHash } from "../../lib/domain";
import { createReadClient } from "../../lib/genlayer/read-client";
import { initialTransactionState, reduceTransactionState, type ConsensusStatus, type ExecutionStatus, type TransactionState } from "../../lib/transaction-state";

export interface ReceiptReader { (hash: TransactionHash): Promise<{ status: ConsensusStatus; execution: ExecutionStatus } | undefined>; }
interface TransactionContextValue { state: TransactionState; execute(write: () => Promise<SubmittedWrite>): Promise<TransactionState>; clear(): void; }
const TransactionContext = createContext<TransactionContextValue | null>(null);
const savedHashKey = "aidtrail.transaction.hash";

export function normalizeGenLayerReceipt(raw: unknown): Awaited<ReturnType<ReceiptReader>> {
  if (!raw || typeof raw !== "object") return undefined;
  const receipt = raw as Record<string, unknown>;
  const status = receipt.statusName ?? receipt.status;
  const execution = receipt.txExecutionResultName ?? receipt.execution ?? receipt.execution_status;
  return typeof status === "string" && typeof execution === "string" ? { status: status as ConsensusStatus, execution: execution as ExecutionStatus } : undefined;
}

function receiptReaderFromNetwork(): ReceiptReader {
  const client = createReadClient();
  return async (hash) => {
    try { return normalizeGenLayerReceipt(await client.getTransaction({ hash })); }
    catch { return undefined; }
  };
}

export function TransactionProvider({ children, readReceipt = receiptReaderFromNetwork(), pollMs = 1_000, readbackAttempts = 5 }: { children: ReactNode; readReceipt?: ReceiptReader; pollMs?: number; readbackAttempts?: number }) {
  const [state, dispatch] = useReducer(reduceTransactionState, initialTransactionState);
  useEffect(() => { const hash = window.sessionStorage.getItem(savedHashKey) as TransactionHash | null; if (hash) dispatch({ type: "submitted", hash }); }, []);
  const execute = useCallback(async (write: () => Promise<SubmittedWrite>) => {
    dispatch({ type: "wallet_approved" });
    try {
      const submitted = await write();
      window.sessionStorage.setItem(savedHashKey, submitted.hash);
      dispatch({ type: "submitted", hash: submitted.hash });
      let receipt: Awaited<ReturnType<ReceiptReader>>;
      for (;;) { receipt = await readReceipt(submitted.hash); if (receipt) break; await new Promise((resolve) => window.setTimeout(resolve, pollMs)); }
      let next = reduceTransactionState({ phase: "submitted", hash: submitted.hash }, { type: "receipt", ...receipt });
      dispatch({ type: "receipt", ...receipt });
      if (next.phase === "verifying_readback") {
        let matches = false;
        for (let attempt = 0; attempt < readbackAttempts && !matches; attempt += 1) { matches = await submitted.readback(); if (!matches && attempt + 1 < readbackAttempts) await new Promise((resolve) => window.setTimeout(resolve, pollMs)); }
        next = reduceTransactionState(next, { type: "readback", matches }); dispatch({ type: "readback", matches });
      }
      if (next.phase === "success" || next.phase === "execution_error" || next.phase === "rejected") window.sessionStorage.removeItem(savedHashKey);
      return next;
    } catch (error) { const message = error instanceof Error ? error.message : "Transaction could not be reconciled."; const next = reduceTransactionState({ phase: "submitted" }, { type: "timeout", message }); dispatch({ type: "timeout", message }); return next; }
  }, [pollMs, readReceipt, readbackAttempts]);
  const value = useMemo<TransactionContextValue>(() => ({ state, execute, clear: () => { window.sessionStorage.removeItem(savedHashKey); dispatch({ type: "rejected", message: "Cleared" }); } }), [execute, state]);
  return <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>;
}

export function useTransaction(): TransactionContextValue { const value = useContext(TransactionContext); if (!value) throw new Error("useTransaction must be used within TransactionProvider"); return value; }

export function TransactionStatus({ state }: { state: TransactionState }) { return <p className="transaction-status" role="status">{state.phase === "success" ? "Confirmed by finalized execution and contract readback." : state.phase === "readback_mismatch" ? "Execution finalized, but the contract state did not reconcile. Refresh and try again." : state.phase === "execution_error" ? "Consensus finalized with an execution error; no success was recorded." : state.error ?? `Transaction status: ${state.phase.replaceAll("_", " ")}.`}{state.hash ? ` Hash: ${state.hash}` : ""}</p>; }
