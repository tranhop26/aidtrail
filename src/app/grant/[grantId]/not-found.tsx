import Link from "next/link";
import { AppShell } from "../../../components/layout/app-shell";
export default function NotFound() { return <AppShell><main className="explore"><section className="empty-state"><p className="eyebrow">Grant not found</p><h1>That trail is not available.</h1><p>The public record may not exist on this network, or the link may be incomplete.</p><Link className="button" href="/grants">Explore grants</Link></section></main></AppShell>; }
