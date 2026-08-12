import { AppShell } from "../../components/layout/app-shell";
import { DashboardClient, type DashboardMode } from "../../components/dashboard/dashboard-client";
import { createAidTrailContract } from "../../lib/genlayer/contract";
import { createReadClient } from "../../lib/genlayer/read-client";
import type { Grant, Milestone, Summary } from "../../lib/domain";

export default async function DashboardPage() {
  const contract = createAidTrailContract({ address: process.env.NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS, readClient: createReadClient() }); let grants: Grant[] = []; let milestones: Milestone[] = []; let summary: Summary | undefined; let mode: DashboardMode = "empty";
  try { const listed = await contract.listGrants(0n, 50n); if (listed.availability === "available") { grants = listed.data; milestones = (await Promise.all(grants.flatMap((grant) => Array.from({ length: Number(grant.milestoneCount) }, (_, index) => contract.readMilestone(grant.grantId, BigInt(index)))))).flatMap((item) => item.availability === "available" ? [item.data] : []); const totals = await contract.readSummary(); summary = totals.availability === "available" ? totals.data : undefined; mode = grants.length ? "ready" : "empty"; } else mode = "read-error"; } catch { mode = "read-error"; }
  return <AppShell><DashboardClient grants={grants} milestones={milestones} summary={summary} mode={mode} /></AppShell>;
}
