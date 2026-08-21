import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Grant, Milestone } from "../../lib/domain";
import { TransactionProvider } from "../providers/transaction-provider";
import { WalletProvider } from "../providers/wallet-provider";
import { GrantActionArea } from "./grant-action-area";

vi.mock("../../lib/genlayer/read-client", () => ({
  createReadClient: () => ({
    readContract: async () => "5",
    getTransaction: async () => undefined,
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
  });

  it("loads deposited contract credit and enables challenge and withdrawal", async () => {
    process.env.NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS = "0x68848ba962a2ff80f1cec4529a4c79d5d35f2c3c";
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: { request: async ({ method }: { method: string }) => method === "eth_accounts" ? [account] : "0xf22f" },
    });
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<WalletProvider expectedChainId="61999"><TransactionProvider><GrantActionArea grant={grant} milestone={milestone} milestones={[milestone]} /></TransactionProvider></WalletProvider>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.find((button) => button.textContent === "Challenge decision")?.disabled).toBe(false);
    expect(buttons.find((button) => button.textContent === "Withdraw refundable credit")?.disabled).toBe(false);
    await act(async () => root.unmount());
  });
});
