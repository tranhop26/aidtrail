import type { Grant, Milestone } from "../../lib/domain";

export function ActivityPanel({ grant, milestones }: { grant: Grant; milestones: Milestone[] }) {
  return <section className="activity-panel"><h2>Contract activity</h2><ol>{[{ label: "Grant created", detail: `Plan ${grant.planHash}` }, { label: "Funding", detail: `${grant.funded.toString()} GEN committed of ${grant.escrowTarget.toString()} GEN` }, ...milestones.map((milestone) => ({ label: `Milestone ${Number(milestone.index) + 1}: ${milestone.status.replaceAll("_", " ")}`, detail: `${milestone.evidenceCount.toString()} evidence source(s), ${milestone.challengeNonce.toString()} challenge(s)` }))].map((item, index) => <li key={`${item.label}-${index}`}><strong>{item.label}</strong><span>{item.detail}</span></li>)}</ol><p>Activity is derived from the latest public contract state; timestamps are only shown where the contract exposes them.</p></section>;
}
