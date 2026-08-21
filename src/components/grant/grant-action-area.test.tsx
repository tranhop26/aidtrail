import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Grant, Milestone } from "../../lib/domain";
import { CreditForm } from "../forms/credit-form";
import { TransactionProvider } from "../providers/transaction-provider";
import { WalletProvider } from "../providers/wallet-provider";
import { GrantActionArea } from "./grant-action-area";

const contractState = vi.hoisted(() => ({ credit: 0n, reads: [] as Array<{ functionName: string; args?: unknown[] }>, writes: [] as Array<{ functionName: string; value: bigint }>, readPlan: [] as Array<string | Promise<string>> }));
vi.mock("../../lib/genlayer/read-client", () => ({
  createReadClient: () => ({
    readContract: async (input: { functionName: string; args?: unknown[] }) => { contractState.reads.push(input); return await (contractState.readPlan.shift() ?? contractState.credit.toString()); },
    getTransaction: async () => undefined,
  }),
}));
vi.mock("../../lib/genlayer/write-client", () => ({
  createWriteClient: async () => ({
    connect: async () => undefined,
    writeContract: async ({ functionName, value }: { functionName: string; value: bigint }) => {
      contractState.writes.push({ functionName, value });
      if (functionName === "deposit_challenge_credit") contractState.credit += value;
      if (functionName === "withdraw_credit") contractState.credit = 0n;
      return `0x${"a".repeat(64)}` as `0x${string}`;
    },
  }),
}));

const account = "0x3333333333333333333333333333333333333333" as const;
const grant: Grant = {
  grantId: "ATG-8", schemaVersion: 1n, sponsor: "0x1111111111111111111111111111111111111111", beneficiary: "0x2222222222222222222222222222222222222222",
  projectName: "River Refill", organization: "Blue Loop", projectReference: "https://example.org/project", region: "Mekong", category: "Water", description: "Test grant", planHash: "0xplan",
  escrowTarget: 100n, milestoneCount: 1n, evidencePolicyVersion: "v1", challengeBond: 5n, challengeWindow: 86_400n, status: "ACTIVE", funded: 100n, reserved: 100n,
};
const milestone: Milestone = {
  grantId: grant.grantId, index: 0n, title: "Install station", criteria: "Station is installed", allocation: 100n, deadline: 1n,
  evidenceRequirement: "Public field report", minIndependentSources: 1n, criteriaHash: "0xcriteria", status: "PROVISIONAL_APPROVAL", submissionNonce: 1n,
  evidencePackHash: "0xevidence", reservedAmount: 100n, evidenceCount: 1n, challengeDeadline: 4_000_000_000n, challengeNonce: 0n,
  challengedDecisionNonce: 0n, executionComplete: false, expired: false,
};

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("GrantActionArea connected-wallet credit workflow", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "ethereum");
    delete process.env.NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS;
    contractState.credit = 0n;
    contractState.reads = [];
    contractState.writes = [];
    contractState.readPlan = [];
  });

  it("loads deposited contract credit and enables challenge and withdrawal", async () => {
    process.env.NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS = "0x68848ba962a2ff80f1cec4529a4c79d5d35f2c3c";
    let accountsChanged: ((accounts: unknown) => void) | undefined;
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: {
        request: async ({ method }: { method: string }) => method === "eth_accounts" ? [account] : "0xf22f",
        on: (event: string, callback: (accounts: unknown) => void) => { if (event === "accountsChanged") accountsChanged = callback; },
        removeListener: () => undefined,
      },
    });
    const container = document.createElement("div");
    const root = createRoot(container);

    const receipt = async () => ({ status: "FINALIZED" as const, execution: "FINISHED_WITH_RETURN" as const });
    await act(async () => {
      root.render(<WalletProvider expectedChainId="61999"><TransactionProvider readReceipt={receipt}><CreditForm credit={0n} /></TransactionProvider></WalletProvider>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const amount = container.querySelector<HTMLInputElement>('input[type="number"]');
    if (!amount) throw new Error("missing deposit amount input");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(amount, "5");
      amount.dispatchEvent(new Event("input", { bubbles: true }));
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Deposit credit")?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(contractState.writes).toContainEqual({ functionName: "deposit_challenge_credit", value: 5n });

    await act(async () => {
      root.render(<WalletProvider expectedChainId="61999"><TransactionProvider readReceipt={receipt}><GrantActionArea grant={grant} milestone={milestone} milestones={[milestone]} /></TransactionProvider></WalletProvider>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.find((button) => button.textContent === "Challenge decision")?.disabled).toBe(false);
    expect(buttons.find((button) => button.textContent === "Withdraw refundable credit")?.disabled).toBe(false);
    expect(contractState.reads.some((read) => read.functionName === "get_credit" && read.args?.[0] === account)).toBe(true);
    let resolveOlderRead: ((value: string) => void) | undefined;
    const olderRead = new Promise<string>((resolve) => { resolveOlderRead = resolve; });
    contractState.readPlan = [olderRead, "5", "0", "0"];
    await act(async () => { accountsChanged?.([]); await new Promise((resolve) => setTimeout(resolve, 0)); });
    await act(async () => { accountsChanged?.([account]); await new Promise((resolve) => setTimeout(resolve, 0)); });
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Withdraw refundable credit")?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => { resolveOlderRead?.("5"); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(contractState.credit).toBe(0n);
    expect(Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Withdraw refundable credit")?.disabled).toBe(true);
    await act(async () => root.unmount());
  });
});
