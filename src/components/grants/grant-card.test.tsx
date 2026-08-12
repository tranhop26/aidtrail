import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Grant, Milestone } from "../../lib/domain";
import { GrantCard } from "./grant-card";

const grant: Grant = {
  grantId: "ATG-24", schemaVersion: 1n,
  sponsor: "0x1111111111111111111111111111111111111111",
  beneficiary: "0x2222222222222222222222222222222222222222",
  projectName: "River Refill Network", organization: "Blue Loop Collective",
  projectReference: "https://example.org/river-refill", region: "Mekong Delta",
  category: "Water", description: "Community refill stations and repair training.",
  planHash: "0xplan", escrowTarget: 500n, milestoneCount: 3n,
  evidencePolicyVersion: "v1", challengeBond: 25n, challengeWindow: 86400n,
  status: "ACTIVE", funded: 320n, reserved: 0n,
};

const paidMilestone = (index: bigint): Milestone => ({
  grantId: grant.grantId, index, title: "Install refill stations", criteria: "Installed and documented",
  allocation: 100n, deadline: 0n, evidenceRequirement: "Public field report", minIndependentSources: 1n,
  criteriaHash: "0xcriteria", status: "PAID", submissionNonce: 1n, evidencePackHash: "0xevidence",
  reservedAmount: 0n, evidenceCount: 2n, challengeDeadline: 0n, challengeNonce: 0n,
  challengedDecisionNonce: 0n, executionComplete: true, expired: false,
});

describe("GrantCard", () => {
  it("shows exact contract progress and simulated-value label", () => {
    const markup = renderToStaticMarkup(<GrantCard grant={grant} milestones={[paidMilestone(0n), paidMilestone(1n)]} />);

    expect(markup).toContain("<b>2</b> of 3 milestones paid");
    expect(markup).toContain("320 GEN");
    expect(markup).toMatch(/simulated Studionet value/i);
  });

  it("does not present a non-paid milestone as a payout", () => {
    const pending = { ...paidMilestone(2n), status: "PENDING" as const, executionComplete: false };
    const markup = renderToStaticMarkup(<GrantCard grant={grant} milestones={[pending]} />);

    expect(markup).toContain("Awaiting evidence");
    expect(markup).not.toContain("Payout complete");
  });

  it("keeps a descriptive image alternative and an accessible project link", () => {
    const markup = renderToStaticMarkup(<GrantCard grant={grant} milestones={[]} />);

    expect(markup).toContain('alt="River Refill Network project landscape"');
    expect(markup).toContain('aria-label="Explore River Refill Network"');
  });
});
