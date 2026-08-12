import { AppShell } from "../../components/layout/app-shell";

export default function Loading() { return <AppShell><main className="explore" aria-busy="true" aria-label="Loading grants"><div className="skeleton hero-skeleton" /> <div className="skeleton filter-skeleton" /> <div className="card-grid">{Array.from({ length: 3 }, (_, index) => <div className="skeleton card-skeleton" key={index} />)}</div></main></AppShell>; }
