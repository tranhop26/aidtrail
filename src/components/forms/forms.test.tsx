import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChallengeForm } from "./challenge-form";
import { EvidenceForm } from "./evidence-form";
import { validateGrantPlan } from "./grant-plan-wizard";
import { Providers } from "../../app/providers";
import type { Grant, Milestone } from "../../lib/domain";
import { TransactionProvider } from "../providers/transaction-provider";
import { WalletProvider } from "../providers/wallet-provider";

const writeContract = vi.hoisted(() => vi.fn(async (input: { functionName: string; args?: unknown[]; value: bigint }) => { void input; return `0x${"a".repeat(64)}` as `0x${string}`; }));
vi.mock("../../lib/genlayer/read-client", () => ({
  createReadClient: () => ({
    readContract: async () => ({ network: "studionet", contract_replay_marker: "aidtrail:contract" }),
    getTransaction: async () => undefined,
  }),
}));
vi.mock("../../lib/genlayer/write-client", () => ({ createWriteClient: async () => ({ connect: async () => undefined, writeContract }) }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AidTrail workflow forms", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "ethereum");
    delete process.env.NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS;
    writeContract.mockClear();
  });

  it("blocks a plan whose allocations do not equal escrow target", () => {
    const result = validateGrantPlan({
      beneficiary: "0x2222222222222222222222222222222222222222",
      projectName: "Community water", organization: "Blue Loop", projectReference: "https://example.org/plan",
      region: "Mekong", category: "Water", description: "A public refill network for neighbourhoods.",
      target: "100", allocations: ["30", "30", "30"], titles: ["Map", "Build", "Train"],
      criteria: ["Published map", "Installed stations", "Training report"], deadlines: ["2026-09-01", "2026-10-01", "2026-11-01"],
      evidenceRequirements: ["Public URL", "Public URL", "Public URL"], sources: ["1", "1", "1"],
      evidencePolicyVersion: "v1", challengeBond: "10", challengeWindow: "86400",
    });

    expect(result.errors).toContain("Allocations must total 100 GEN.");
    expect(result.canReview).toBe(false);
  });

  it("shows challenge bond destinations before signing", () => {
    const markup = renderToStaticMarkup(<Providers><ChallengeForm grantId="ATG-24" milestoneIndex={1n} challengeBond={25n} /></Providers>);

    expect(markup).toMatch(/returned if decision changes/i);
    expect(markup).toMatch(/credited to beneficiary if upheld/i);
  });

  it("enables a two-source milestone submission only after both sources are complete", async () => {
    const account = "0x2222222222222222222222222222222222222222" as const;
    const grant: Grant = { grantId: "ATG-24", schemaVersion: 1n, sponsor: "0x1111111111111111111111111111111111111111", beneficiary: account, projectName: "Community water", organization: "Blue Loop", projectReference: "https://example.org/plan", region: "Mekong", category: "Water", description: "Test grant", planHash: "0xplan", escrowTarget: 100n, milestoneCount: 1n, evidencePolicyVersion: "v1", challengeBond: 10n, challengeWindow: 86_400n, status: "ACTIVE", funded: 100n, reserved: 100n };
    const milestone: Milestone = { grantId: grant.grantId, index: 0n, title: "Publish report", criteria: "Publish verified results", allocation: 100n, deadline: 4_000_000_000n, evidenceRequirement: "Two independent reports", minIndependentSources: 2n, criteriaHash: "0xcriteria", status: "PENDING", submissionNonce: 0n, evidencePackHash: "", reservedAmount: 100n, evidenceCount: 0n, challengeDeadline: 0n, challengeNonce: 0n, challengedDecisionNonce: 0n, executionComplete: false, expired: false };
    process.env.NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS = "0x68848ba962a2ff80f1cec4529a4c79d5d35f2c3c";
    Object.defineProperty(window, "ethereum", { configurable: true, value: { request: async ({ method }: { method: string }) => method === "eth_accounts" ? [account] : "0xf22f" } });
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<WalletProvider expectedChainId="61999"><TransactionProvider readReceipt={async () => ({ status: "FINALIZED", execution: "FINISHED_WITH_ERROR" })}><EvidenceForm grant={grant} milestone={milestone} /></TransactionProvider></WalletProvider>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelectorAll('[data-evidence-source="independent"]').length).toBe(2);
    expect(container.querySelector("button")?.disabled).toBe(true);
    const fill = (selector: string, value: string) => {
      const input = container.querySelector<HTMLInputElement>(selector);
      if (!input) throw new Error(`missing input ${selector}`);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    await act(async () => {
      fill('[data-evidence-field="report-url"]', "https://beneficiary.example/report");
      fill('[data-evidence-field="report-hash"]', `0x${"1".repeat(64)}`);
      fill('[data-source-index="0"][data-source-field="url"]', "https://auditor-one.example/report");
      fill('[data-source-index="0"][data-source-field="issuer"]', "Auditor One");
      fill('[data-source-index="0"][data-source-field="hash"]', `0x${"2".repeat(64)}`);
      fill('[data-source-index="1"][data-source-field="url"]', "https://auditor-two.example/report");
      fill('[data-source-index="1"][data-source-field="issuer"]', "Auditor Two");
      fill('[data-source-index="1"][data-source-field="hash"]', `0x${"3".repeat(64)}`);
    });

    expect(container.querySelector("button")?.disabled).toBe(false);
    expect(JSON.parse(container.querySelector("pre")?.textContent ?? "{}").independent_sources).toHaveLength(2);
    await act(async () => { fill('[data-source-index="1"][data-source-field="url"]', "https://auditor-one.example/duplicate"); });
    expect(container.querySelector("button")?.disabled).toBe(true);
    await act(async () => { fill('[data-source-index="1"][data-source-field="url"]', "https://auditor-two.example/report"); fill('[data-source-index="1"][data-source-field="issuer"]', "Auditor One"); });
    expect(container.querySelector("button")?.disabled).toBe(true);
    await act(async () => { fill('[data-source-index="1"][data-source-field="issuer"]', "Auditor Two"); fill('[data-source-index="1"][data-source-field="url"]', "https://localhost/report"); });
    expect(container.querySelector("button")?.disabled).toBe(true);
    await act(async () => { fill('[data-source-index="1"][data-source-field="url"]', "https://auditor-two.example/report"); container.querySelector<HTMLButtonElement>("button")?.click(); await new Promise((resolve) => setTimeout(resolve, 0)); });

    expect(writeContract).toHaveBeenCalledOnce();
    const submitted = writeContract.mock.calls[0][0];
    expect(submitted.functionName).toBe("submit_evidence");
    const evidenceJson = submitted.args?.[2];
    expect(typeof evidenceJson).toBe("string");
    if (typeof evidenceJson !== "string") throw new Error("missing evidence JSON");
    expect(JSON.parse(evidenceJson).independent_sources).toHaveLength(2);
    await act(async () => root.unmount());
  });
});
