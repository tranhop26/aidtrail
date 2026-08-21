import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Grant, Milestone } from "../../lib/domain";
import { RoleActions } from "./role-actions";

const sponsor = "0x1111111111111111111111111111111111111111" as const;
const beneficiary = "0x2222222222222222222222222222222222222222" as const;
const stranger = "0x3333333333333333333333333333333333333333" as const;

const grant: Grant = {
  grantId: "ATG-8", schemaVersion: 1n, sponsor, beneficiary, projectName: "River Refill", organization: "Blue Loop",
  projectReference: "https://example.org/project", region: "Mekong", category: "Water", description: "Test grant", planHash: "0xplan",
  escrowTarget: 100n, milestoneCount: 1n, evidencePolicyVersion: "v1", challengeBond: 5n, challengeWindow: 86_400n,
  status: "ACTIVE", funded: 100n, reserved: 0n,
};

function milestone(status: Milestone["status"], challengeDeadline = 0n): Milestone {
  return { grantId: grant.grantId, index: 0n, title: "Install station", criteria: "Station is installed", allocation: 100n, deadline: 0n,
    evidenceRequirement: "Public field report", minIndependentSources: 1n, criteriaHash: "0xcriteria", status, submissionNonce: 1n,
    evidencePackHash: "0xevidence", reservedAmount: 100n, evidenceCount: 1n, challengeDeadline, challengeNonce: 0n,
    challengedDecisionNonce: 0n, executionComplete: false, expired: false };
}

describe("RoleActions", () => {
  it("offers permissionless finalize to an unrelated connected address", () => {
    const markup = renderToStaticMarkup(<RoleActions grant={grant} milestone={milestone("PROVISIONAL_APPROVAL", 100n)} wallet={{ status: "connected", account: stranger }} now={100} />);

    expect(markup).toContain("Finalize payout");
    expect(markup).not.toMatch(/Finalize payout[^>]*disabled/);
  });

  it("does not offer evidence submission to a non-beneficiary", () => {
    const markup = renderToStaticMarkup(<RoleActions grant={grant} milestone={milestone("PENDING")} wallet={{ status: "connected", account: stranger }} now={0} />);

    expect(markup).not.toContain("Submit evidence");
  });

  it("enables challenge when connected-wallet contract credit covers the bond", () => {
    const markup = renderToStaticMarkup(<RoleActions grant={grant} milestone={milestone("PROVISIONAL_APPROVAL", 200n)} wallet={{ status: "connected", account: stranger }} challengeCredit={5n} now={100} />);

    expect(markup).not.toMatch(/<button[^>]*disabled[^>]*>Challenge decision/);
  });

  it("enables withdrawal for any connected wallet with refundable contract credit", () => {
    const markup = renderToStaticMarkup(<RoleActions grant={grant} milestone={milestone("PENDING")} wallet={{ status: "connected", account: stranger }} challengeCredit={5n} now={100} />);

    expect(markup).toContain("Withdraw refundable credit");
    expect(markup).not.toMatch(/<button[^>]*disabled[^>]*>Withdraw refundable credit/);
  });

  it.each(["PENDING", "REQUEST_MORE_INFO", "UNRESOLVED"] as const)("opens expiry for %s only after the 86,400 second cure period", (status) => {
    const due = { ...milestone(status), deadline: 100n };
    const beforeCure = renderToStaticMarkup(<RoleActions grant={grant} milestone={due} wallet={{ status: "connected", account: stranger }} now={86_500} />);
    const afterCure = renderToStaticMarkup(<RoleActions grant={grant} milestone={due} wallet={{ status: "connected", account: stranger }} now={86_501} />);

    expect(beforeCure).toMatch(/<button[^>]*disabled[^>]*>Expire grant/);
    expect(afterCure).not.toMatch(/<button[^>]*disabled[^>]*>Expire grant/);
  });
});
