import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChallengeForm } from "./challenge-form";
import { validateGrantPlan } from "./grant-plan-wizard";
import { Providers } from "../../app/providers";

describe("AidTrail workflow forms", () => {
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
});
