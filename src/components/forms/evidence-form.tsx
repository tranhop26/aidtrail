"use client";

import { useEffect, useMemo, useState } from "react";

import type { Grant, Milestone } from "../../lib/domain";
import { createAidTrailContract, type EvidenceDomain } from "../../lib/genlayer/contract";
import { createReadClient } from "../../lib/genlayer/read-client";
import { createWriteClient } from "../../lib/genlayer/write-client";
import { evidenceReadback } from "../../lib/workflow-readbacks";
import { useTransaction, TransactionStatus } from "../providers/transaction-provider";
import { useWallet } from "../providers/wallet-provider";

interface SourceDraft { url: string; issuer: string; hash: string; }

const unix = () => Math.floor(Date.now() / 1000);
const artifact = (issuer: string, url: string, contentHash: string, subject: object) => ({ schema_version: 1, issuer, url, content_hash: contentHash, content_version: "v1", subject, dates: { observation_start: unix() - 86400, observation_end: unix() - 3600, published_at: unix() - 60 } });
const blankSource = (): SourceDraft => ({ url: "", issuer: "", hash: "" });
const validHash = (value: string) => /^0x[0-9a-fA-F]{64}$/.test(value);

export function EvidenceForm({ grant, milestone }: { grant: Grant; milestone: Milestone }) {
  const wallet = useWallet();
  const transaction = useTransaction();
  const sourceCount = Number(milestone.minIndependentSources);
  const [reportUrl, setReportUrl] = useState("");
  const [reportHash, setReportHash] = useState("");
  const [sources, setSources] = useState<SourceDraft[]>(() => Array.from({ length: sourceCount }, blankSource));
  const [domain, setDomain] = useState<EvidenceDomain>();
  const [domainError, setDomainError] = useState<string>();

  useEffect(() => {
    const contract = createAidTrailContract({ address: process.env.NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS, readClient: createReadClient() });
    void contract.readEvidenceDomain().then((result) => result.availability === "available" ? setDomain(result.data) : setDomainError(result.reason)).catch(() => setDomainError("Evidence replay domain could not be read."));
  }, []);

  const updateSource = (index: number, field: keyof SourceDraft, value: string) => setSources((current) => current.map((source, sourceIndex) => sourceIndex === index ? { ...source, [field]: value } : source));
  const pack = useMemo(() => {
    const subject = { project_name: grant.projectName, project_reference: grant.projectReference, region: grant.region, milestone_title: milestone.title, criteria_hash: milestone.criteriaHash };
    return {
      schema_version: 1,
      action: "SUBMIT_EVIDENCE",
      network: domain?.network ?? "",
      contract_replay_marker: domain?.contractReplayMarker ?? "",
      grant_id: grant.grantId,
      milestone_index: Number(milestone.index),
      submission_nonce: Number(milestone.submissionNonce + 1n),
      report: artifact(grant.beneficiary, reportUrl, reportHash, subject),
      independent_sources: sources.map((source) => artifact(source.issuer.trim(), source.url, source.hash, subject)),
    };
  }, [domain, grant, milestone, reportHash, reportUrl, sources]);
  const ready = Boolean(domain)
    && (sourceCount === 1 || sourceCount === 2)
    && /^https:\/\//.test(reportUrl)
    && validHash(reportHash)
    && sources.length === sourceCount
    && sources.every((source) => /^https:\/\//.test(source.url) && source.issuer.trim().length > 0 && validHash(source.hash));
  const submit = async () => {
    if (!ready || wallet.status !== "connected" || !wallet.account || !wallet.provider) return;
    const client = await createWriteClient(wallet.provider, wallet.account);
    const contract = createAidTrailContract({ address: process.env.NEXT_PUBLIC_AIDTRAIL_CONTRACT_ADDRESS, readClient: createReadClient(), writeClient: client });
    await transaction.execute(() => contract.submitEvidence({ grantId: grant.grantId, milestoneIndex: milestone.index, evidenceJson: JSON.stringify(pack), readback: evidenceReadback(contract, grant.grantId, milestone.index, milestone.submissionNonce) }));
  };

  return <section className="workflow-card">
    <p className="eyebrow">Beneficiary evidence</p>
    <h2>Submit proof without an AidTrail upload.</h2>
    <p>URLs and integrity hashes go directly to the contract. The canonical preview locks the evidence subject, freshness dates, nonce, and replay domain.</p>
    {domainError && <p className="form-errors">{domainError}</p>}
    <div className="form-grid">
      <label className="form-field"><span>Primary public report URL</span><input data-evidence-field="report-url" value={reportUrl} placeholder="https://…" onChange={(event) => setReportUrl(event.target.value)} /></label>
      <label className="form-field"><span>Primary content hash</span><input data-evidence-field="report-hash" value={reportHash} placeholder="0x…" onChange={(event) => setReportHash(event.target.value)} /></label>
    </div>
    {sources.map((source, index) => <fieldset data-evidence-source="independent" key={index}>
      <legend>Independent source {index + 1} of {sourceCount}</legend>
      <div className="form-grid">
        <label className="form-field"><span>Source URL</span><input data-source-index={index} data-source-field="url" value={source.url} placeholder="https://…" onChange={(event) => updateSource(index, "url", event.target.value)} /></label>
        <label className="form-field"><span>Issuer</span><input data-source-index={index} data-source-field="issuer" value={source.issuer} onChange={(event) => updateSource(index, "issuer", event.target.value)} /></label>
        <label className="form-field form-field--wide"><span>Content hash</span><input data-source-index={index} data-source-field="hash" value={source.hash} placeholder="0x…" onChange={(event) => updateSource(index, "hash", event.target.value)} /></label>
      </div>
    </fieldset>)}
    <details><summary>Canonical evidence pack preview</summary><pre>{JSON.stringify(pack, null, 2)}</pre></details>
    <p className="form-hint">{domain ? `Replay domain: ${domain.network} · ${domain.contractReplayMarker}. ` : "Reading replay domain from the contract. "}Freshness is checked at execution. Distinct issuers and hosts protect independent sources.</p>
    <button type="button" className="button" disabled={!ready || wallet.status !== "connected"} onClick={() => void submit()}>Sign evidence submission</button>
    {transaction.state.phase !== "awaiting_wallet" && <TransactionStatus state={transaction.state} />}
  </section>;
}
