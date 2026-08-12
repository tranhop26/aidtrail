import type { Milestone } from "../../lib/domain";
import { ExplorerLink } from "./grant-overview";

const date = (seconds: bigint) => seconds === 0n ? "Not recorded" : new Date(Number(seconds) * 1_000).toLocaleString();
export function MilestoneTimeline({ milestones, selectedIndex }: { milestones: Milestone[]; selectedIndex?: bigint }) {
  return <section className="milestone-timeline"><h2>Immutable milestone timeline</h2><ol>{milestones.map((milestone) => <li key={milestone.index.toString()} className={selectedIndex === milestone.index ? "is-selected" : undefined}><div><span>Milestone {Number(milestone.index) + 1}</span><h3>{milestone.title}</h3><p>{milestone.criteria}</p><dl><div><dt>Criteria commitment</dt><dd><code>{milestone.criteriaHash}</code> <ExplorerLink value={milestone.criteriaHash} label="Explorer" /></dd></div><div><dt>Evidence requirement</dt><dd>{milestone.evidenceRequirement}; {milestone.minIndependentSources.toString()} independent source(s)</dd></div><div><dt>Deadline</dt><dd>{date(milestone.deadline)}</dd></div></dl></div><aside><strong>{milestone.allocation.toString()} GEN</strong><span>{milestone.status.replaceAll("_", " ")}</span></aside></li>)}</ol></section>;
}
