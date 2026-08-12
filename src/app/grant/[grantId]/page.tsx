import { notFound } from "next/navigation";

import { ActivityPanel } from "../../../components/grant/activity-panel";
import { EvidencePanel } from "../../../components/grant/evidence-panel";
import { GrantActionArea } from "../../../components/grant/grant-action-area";
import { GrantOverview } from "../../../components/grant/grant-overview";
import { MilestoneTimeline } from "../../../components/grant/milestone-timeline";
import { AppShell } from "../../../components/layout/app-shell";
import type { Grant, Milestone } from "../../../lib/domain";
import { createAidTrailContract } from "../../../lib/genlayer/contract";
import { createReadClient } from "../../../lib/genlayer/read-client";

const sponsor = "0x1111111111111111111111111111111111111111" as const;
const beneficiary = "0x2222222222222222222222222222222222222222" as const;
function previewGrant(grantId: string): Grant { return { grantId, schemaVersion: 1n, sponsor, beneficiary, projectName: "River Refill Network", organization: "Blue Loop Collective", projectReference: "https://example.org/river-refill", region: "Mekong Delta", category: "Water", description: "Solar-powered refill stations that replace single-use plastic in river communities.", planHash: "Preview only", escrowTarget: 500n, milestoneCount: 3n, evidencePolicyVersion: "preview", challengeBond: 25n, challengeWindow: 86_400n, status: "ACTIVE", funded: 320n, reserved: 0n }; }
function previewMilestones(grantId: string): Milestone[] { return ["PENDING", "PROVISIONAL_APPROVAL", "PAID"].map((status, index) => ({ grantId, index: BigInt(index), title: ["Map refill locations", "Install solar station", "Publish repair training"][index], criteria: ["Community mapping is published with local partners.", "A working station and independent field report are committed.", "Training materials and attendance evidence are committed."][index], allocation: [140n, 220n, 140n][index], deadline: 0n, evidenceRequirement: "Public field report", minIndependentSources: 1n, criteriaHash: `preview-criteria-${index + 1}`, status: status as Milestone["status"], submissionNonce: index === 0 ? 0n : 1n, evidencePackHash: index === 0 ? "" : `preview-evidence-${index + 1}`, reservedAmount: 0n, evidenceCount: index === 0 ? 0n : 2n, challengeDeadline: 0n, challengeNonce: 0n, challengedDecisionNonce: 0n, executionComplete: status === "PAID", expired: false })); }

export default async function GrantPage({ params }: { params: Promise<{ grantId: string }> }) {
  const { grantId } = await params;
  let grant: Grant | undefined;
  let milestones: Milestone[] = [];
  let notice: string | undefined;
  const contract = createAidTrailContract({ address: process.env.NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS, readClient: createReadClient() });
  try { const result = await contract.readGrant(grantId); if (result.availability === "available") { grant = result.data; const loaded = await Promise.all(Array.from({ length: Number(grant.milestoneCount) }, (_, index) => contract.readMilestone(grantId, BigInt(index)))); milestones = loaded.flatMap((item) => item.availability === "available" ? [item.data] : []); } else if (grantId.startsWith("PREVIEW-")) { grant = previewGrant(grantId); milestones = previewMilestones(grantId); notice = "Preview record — connect a deployed contract for authoritative reads."; } }
  catch { if (grantId.startsWith("PREVIEW-")) { grant = previewGrant(grantId); milestones = previewMilestones(grantId); notice = "Public read is unavailable; showing the non-authoritative preview record."; } }
  if (!grant) notFound();
  const selected = milestones.find((milestone) => !milestone.executionComplete) ?? milestones[0];
  return <AppShell><main className="grant-detail">{notice && <aside className="read-notice" role="status">{notice}</aside>}<GrantOverview grant={grant} /><div className="grant-detail__grid"><div><MilestoneTimeline milestones={milestones} selectedIndex={selected?.index} />{selected && <EvidencePanel grant={grant} milestone={selected} />}</div><aside>{selected && <GrantActionArea grant={grant} milestone={selected} milestones={milestones} />}<ActivityPanel grant={grant} milestones={milestones} /></aside></div></main></AppShell>;
}
