"use client";

import { AppShell } from "../../components/layout/app-shell";

export default function Error({ reset }: { error: Error; reset: () => void }) { return <AppShell><main className="explore"><section className="empty-state"><p className="eyebrow">Read interrupted</p><h1>Our trail went quiet.</h1><p>Nothing has been changed. Retry the public contract read.</p><button type="button" onClick={reset}>Try again</button></section></main></AppShell>; }
