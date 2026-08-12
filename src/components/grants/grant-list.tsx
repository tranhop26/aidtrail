import Link from "next/link";

import type { Grant } from "../../lib/domain";
import { GrantCard } from "./grant-card";

export function GrantList({ grants, total, page, pageSize }: { grants: Grant[]; total: number; page: number; pageSize: number }) { const pages = Math.ceil(total / pageSize); if (!grants.length) return <section className="empty-state"><p className="eyebrow">No matches yet</p><h2>Try a wider trail.</h2><p>Change a category, contract state, or search phrase to discover more community projects.</p><Link className="button button--cobalt" href="/grants">Clear filters</Link></section>; return <section className="grant-list" aria-label="Grant projects"><div className="card-grid">{grants.map((grant) => <GrantCard key={grant.grantId} grant={grant} />)}</div>{pages > 1 && <nav className="pagination" aria-label="Grant pages">{page > 1 && <Link href={`/grants?page=${page - 1}`}>← Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link href={`/grants?page=${page + 1}`}>Next →</Link>}</nav>}</section>; }
