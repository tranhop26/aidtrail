import { AppShell } from "../../components/layout/app-shell";
import { GrantFilters, type ExploreFilters } from "../../components/grants/grant-filters";
import { GrantList } from "../../components/grants/grant-list";
import { ImpactHero } from "../../components/grants/impact-hero";
import { createAidTrailContract } from "../../lib/genlayer/contract";
import { createReadClient } from "../../lib/genlayer/read-client";
import type { Grant, Summary } from "../../lib/domain";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const pageSize = 9;

const sampleGrants: Grant[] = [
  { grantId: "PREVIEW-01", schemaVersion: 1n, sponsor: "0x1111111111111111111111111111111111111111", beneficiary: "0x2222222222222222222222222222222222222222", projectName: "River Refill Network", organization: "Blue Loop Collective", projectReference: "https://example.org/river-refill", region: "Mekong Delta", category: "Water", description: "Solar-powered refill stations that replace single-use plastic in river communities.", planHash: "Preview only", escrowTarget: 500n, milestoneCount: 3n, evidencePolicyVersion: "preview", challengeBond: 25n, challengeWindow: 86400n, status: "ACTIVE", funded: 320n, reserved: 0n },
  { grantId: "PREVIEW-02", schemaVersion: 1n, sponsor: "0x1111111111111111111111111111111111111111", beneficiary: "0x2222222222222222222222222222222222222222", projectName: "City Canopy Commons", organization: "Leaf by Leaf", projectReference: "https://example.org/canopy", region: "Chiang Mai", category: "Climate", description: "Neighbourhood nurseries cultivating shade, habitat, and paid youth stewardship.", planHash: "Preview only", escrowTarget: 720n, milestoneCount: 4n, evidencePolicyVersion: "preview", challengeBond: 30n, challengeWindow: 86400n, status: "FUNDING", funded: 420n, reserved: 0n },
  { grantId: "PREVIEW-03", schemaVersion: 1n, sponsor: "0x1111111111111111111111111111111111111111", beneficiary: "0x2222222222222222222222222222222222222222", projectName: "Open Clinic Cart", organization: "Care Cart Lab", projectReference: "https://example.org/clinic-cart", region: "Lampang", category: "Health", description: "Mobile primary-care equipment co-designed with rural health volunteers.", planHash: "Preview only", escrowTarget: 340n, milestoneCount: 2n, evidencePolicyVersion: "preview", challengeBond: 20n, challengeWindow: 86400n, status: "COMPLETED", funded: 340n, reserved: 0n },
];

function filterGrants(grants: Grant[], filters: ExploreFilters) {
  const needle = filters.query.toLocaleLowerCase();
  const filtered = grants.filter((grant) => (!needle || [grant.projectName, grant.organization, grant.region, grant.category, grant.description].join(" ").toLocaleLowerCase().includes(needle)) && (filters.category === "All" || grant.category === filters.category) && (filters.state === "All" || grant.status === filters.state));
  return filtered.sort((left, right) => filters.sort === "funded" ? Number(right.funded - left.funded) : filters.sort === "target" ? Number(right.escrowTarget - left.escrowTarget) : left.projectName.localeCompare(right.projectName));
}

export default async function GrantsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const sortParam = first(params.sort);
  const sort: ExploreFilters["sort"] = sortParam === "funded" || sortParam === "target" ? sortParam : "recent";
  const filters: ExploreFilters = { query: first(params.q) ?? "", category: first(params.category) ?? "All", state: first(params.state) ?? "All", sort, page: Math.max(1, Number(first(params.page)) || 1) };
  const contract = createAidTrailContract({ address: process.env.NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS, readClient: createReadClient() });
  let grants: Grant[] = sampleGrants;
  let summary: Summary | undefined;
  let notice: string | undefined = "Preview collection — connect a deployed AidTrail contract to browse authoritative records.";
  try {
    const [grantsResult, summaryResult] = await Promise.all([contract.listGrants(0n, 100n), contract.readSummary()]);
    if (grantsResult.availability === "available") { grants = grantsResult.data; notice = undefined; }
    if (summaryResult.availability === "available") summary = summaryResult.data;
  } catch { notice = "We could not refresh the public contract read. Try again when the network is available."; }
  const allCategories = [...new Set(grants.map((grant) => grant.category))];
  const results = filterGrants(grants, filters);
  const visible = results.slice((filters.page - 1) * pageSize, filters.page * pageSize);
  return <AppShell><ImpactHero summary={summary} grantCount={grants.length} /><main className="explore"><div className="explore__heading"><p className="eyebrow">Impact mosaic</p><h1>Discover work worth following.</h1><p>Every milestone is a public promise. Every completed payout must be proven by the contract.</p></div>{notice && <aside className="read-notice" role="status"><span aria-hidden="true">◌</span>{notice}<a href="/grants">Retry read</a></aside>}<GrantFilters filters={filters} categories={allCategories} resultCount={results.length} /><GrantList grants={visible} total={results.length} page={filters.page} pageSize={pageSize} /></main></AppShell>;
}
