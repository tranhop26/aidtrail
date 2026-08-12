import type { Grant } from "../../lib/domain";

const gen = (value: bigint) => `${new Intl.NumberFormat("en-US").format(value)} GEN`;
const shortHash = (value: string) => value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
export function ExplorerLink({ value, label }: { value: string; label: string }) {
  const base = process.env.NEXT_PUBLIC_GENLAYER_EXPLORER_URL;
  return base && value.startsWith("0x") ? <a href={`${base.replace(/\/$/, "")}/tx/${value}`} target="_blank" rel="noreferrer">{label} ↗</a> : <span title="Configure NEXT_PUBLIC_GENLAYER_EXPLORER_URL to open the explorer">{label}</span>;
}
export function GrantOverview({ grant }: { grant: Grant }) {
  const fundedPercent = grant.escrowTarget === 0n ? 0 : Math.min(100, Number((grant.funded * 100n) / grant.escrowTarget));
  return <section className="grant-overview"><p className="eyebrow">Public grant trail</p><div className="grant-overview__top"><div><p className="grant-overview__meta">{grant.category} · {grant.region}</p><h1>{grant.projectName}</h1><p className="organization">{grant.organization}</p><p>{grant.description}</p></div><aside><span className={`status status--${grant.status.toLowerCase()}`}><i />{grant.status.replaceAll("_", " ")}</span><strong>{gen(grant.funded)}</strong><span>of {gen(grant.escrowTarget)} committed</span><div className="progress" aria-label={`${fundedPercent}% funded`}><span style={{ width: `${fundedPercent}%` }} /></div><small>Simulated Studionet GEN value — not money.</small></aside></div><dl className="provenance-grid"><div><dt>Plan commitment</dt><dd><code>{shortHash(grant.planHash)}</code> <ExplorerLink value={grant.planHash} label="Explorer" /></dd></div><div><dt>Evidence policy</dt><dd>{grant.evidencePolicyVersion} · schema {grant.schemaVersion.toString()}</dd></div><div><dt>Sponsor</dt><dd><ExplorerLink value={grant.sponsor} label={shortHash(grant.sponsor)} /></dd></div><div><dt>Beneficiary</dt><dd><ExplorerLink value={grant.beneficiary} label={shortHash(grant.beneficiary)} /></dd></div></dl></section>;
}
