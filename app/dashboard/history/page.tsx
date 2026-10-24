"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import InvestigationJourney from "@/components/platform/InvestigationJourney"

type MemoryTab =
  | "documents"
  | "versions"
  | "verified_claims"
  | "failed_claims"
  | "evidence_memory"
  | "history"

interface DocRegistryItem {
  id: string
  title: string
  filename: string
  domain: string
  chunks: number
  isDataset?: boolean
  datasetName?: string
  version?: number
  createdAt: string
  status?: string
  sourceFiles?: Array<{ id: string; filename: string; fileType: string; sheets?: Array<{ name: string; rowCount: number }> }>
}

interface ClaimRecord {
  id: string
  queryId: string
  query: string
  claim: string
  domain: string
  source: string
  date: string
  evidence: string
  decision: string
  similarity: number
  rootCause?: string
}

interface InvestigationHistoryItem {
  id: string
  queryId: string
  timestamp: string
  query: string
  domain: string
  decision: string
  confidenceScore: number
  trustScore: number
  factScore: number
  rawLlmResponse: string
  finalResponse: string
  claimsCount: number
  contradictionsCount: number
}

export default function RedesignedMemoryPage() {
  const [activeTab, setActiveTab] = useState<MemoryTab>("documents")
  const [docs, setDocs] = useState<DocRegistryItem[]>([])
  const [history, setHistory] = useState<InvestigationHistoryItem[]>([])
  const [verifiedClaims, setVerifiedClaims] = useState<ClaimRecord[]>([])
  const [failedClaims, setFailedClaims] = useState<ClaimRecord[]>([])
  const [evidenceCitations, setEvidenceCitations] = useState<Array<{ source: string; text: string; count: number; lastUsed: string }>>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<any | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Fetch Docs
      const docsRes = await fetch("/api/docs")
      if (docsRes.ok) {
        const docsData = await docsRes.json()
        if (Array.isArray(docsData)) setDocs(docsData)
      }

      // 2. Fetch Audit / Investigations
      const auditRes = await fetch("/api/audit-log?limit=100")
      if (auditRes.ok) {
        const auditData = await auditRes.json()
        if (Array.isArray(auditData)) {
          const hist: InvestigationHistoryItem[] = auditData.map((e: any) => ({
            id: e.id,
            queryId: e.id,
            timestamp: e.timestamp,
            query: e.query,
            domain: e.firewallDomain || e.domain,
            decision: e.decision,
            confidenceScore: e.confidenceScore || 0,
            trustScore: e.trustScore || Math.round((e.confidenceScore || 0) * 100),
            factScore: e.factScore || 0,
            rawLlmResponse: e.llmResponse || "",
            finalResponse: e.finalResponse || "",
            claimsCount: (e.safety?.claims || []).length,
            contradictionsCount: e.conflicts?.length || 0,
          }))
          setHistory(hist)

          // Extract verified & failed claims
          const verified: ClaimRecord[] = []
          const failed: ClaimRecord[] = []
          const citationMap = new Map<string, { source: string; text: string; count: number; lastUsed: string }>()

          for (const e of auditData) {
            const claims = e.safety?.claims || []
            for (const c of claims) {
              const rec: ClaimRecord = {
                id: c.id || `${e.id}-claim`,
                queryId: e.id,
                query: e.query,
                claim: c.claim,
                domain: e.firewallDomain || e.domain,
                source: c.retrievedDocument || e.docTitle || "Knowledge Base",
                date: e.timestamp,
                evidence: c.paragraph || "No excerpt recorded",
                decision: e.decision,
                similarity: c.similarity || 0,
                rootCause: c.verdict === "contradiction" ? "Contradicted factual claim" : c.verdict === "unsupported" ? "Missing evidence citation" : undefined,
              }

              if (c.verdict === "supported") {
                verified.push(rec)
              } else if (c.verdict === "contradiction" || c.verdict === "unsupported") {
                failed.push(rec)
              }

              if (c.paragraph && c.retrievedDocument) {
                const key = `${c.retrievedDocument}::${c.paragraph.slice(0, 50)}`
                const existing = citationMap.get(key)
                if (existing) {
                  existing.count++
                  existing.lastUsed = e.timestamp
                } else {
                  citationMap.set(key, {
                    source: c.retrievedDocument,
                    text: c.paragraph,
                    count: 1,
                    lastUsed: e.timestamp,
                  })
                }
              }
            }
          }

          setVerifiedClaims(verified)
          setFailedClaims(failed)
          setEvidenceCitations(Array.from(citationMap.values()).sort((a, b) => b.count - a.count))
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const tabNames: Array<{ id: MemoryTab; label: string; count?: number }> = [
    { id: "documents", label: "1. Document Memory", count: docs.length },
    { id: "versions", label: "2. Version Memory", count: docs.filter((d) => (d.version || 1) > 1).length },
    { id: "verified_claims", label: "3. Verified Claim Memory", count: verifiedClaims.length },
    { id: "failed_claims", label: "4. Failed Claim Memory", count: failedClaims.length },
    { id: "evidence_memory", label: "5. Evidence Memory", count: evidenceCitations.length },
    { id: "history", label: "6. Verification History", count: history.length },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Firewall Memory System</h1>
          <p className="text-sm text-muted mt-1">
            Deterministic organizational memory: documents, versions, verified claims, failure patterns, and citations.
          </p>
        </div>
        <Link
          href="/dashboard/verify"
          className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-semibold shadow-sm"
        >
          Verify in Console →
        </Link>
      </div>

      <InvestigationJourney current="history" />

      {/* Memory Dimensions Navigation Tabs */}
      <div className="flex rounded-xl border border-border bg-white dark:bg-slate-900 dark:border-slate-700 p-1 gap-1 overflow-x-auto">
        {tabNames.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id)
              setSelectedItem(null)
            }}
            className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === tab.id
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: Document Memory */}
      {activeTab === "documents" && (
        <div className="rounded-xl border border-border bg-white dark:bg-slate-900 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-border dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
            <h3 className="font-semibold text-sm">Indexed Document Knowledge Base Memory</h3>
            <p className="text-xs text-muted">All active datasets, source files, and schema structures held in memory.</p>
          </div>
          <div className="divide-y divide-border dark:divide-slate-700">
            {docs.length === 0 ? (
              <p className="p-6 text-sm text-center text-muted">No documents stored in memory.</p>
            ) : (
              docs.map((d) => (
                <div key={d.id} className="p-4 space-y-2 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{d.datasetName || d.title}</p>
                      <p className="text-xs text-muted">
                        Domain: <strong className="capitalize">{d.domain}</strong> · Chunks: <strong>{d.chunks}</strong> · Added: {new Date(d.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                      {d.status || "READY"}
                    </span>
                  </div>

                  {d.sourceFiles && d.sourceFiles.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                      {d.sourceFiles.map((sf) => (
                        <div key={sf.id} className="p-2 rounded bg-slate-50 dark:bg-slate-800 text-xs flex justify-between">
                          <span className="font-medium truncate max-w-[250px]">{sf.filename}</span>
                          <span className="text-muted uppercase text-[10px]">{sf.fileType}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Version Memory */}
      {activeTab === "versions" && (
        <div className="rounded-xl border border-border bg-white dark:bg-slate-900 dark:border-slate-700 overflow-hidden p-5 space-y-4">
          <div className="border-b border-border dark:border-slate-800 pb-3">
            <h3 className="font-semibold text-sm">Dataset Version Progression Memory</h3>
            <p className="text-xs text-muted">Tracks dataset version increments (v1 → v2) and content fingerprint history.</p>
          </div>
          {docs.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">No dataset versions recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {docs.map((d) => (
                <div key={d.id} className="p-4 rounded-lg border border-border bg-slate-50 dark:bg-slate-800/40 text-xs flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-foreground">{d.datasetName || d.title}</p>
                    <p className="text-muted mt-0.5">Active Version: <strong>v{d.version || 1}</strong> · {d.sourceFiles?.length || 1} file(s) · {d.chunks} chunks</p>
                  </div>
                  <span className="px-3 py-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-mono font-bold">
                    v{d.version || 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Verified Claim Memory */}
      {activeTab === "verified_claims" && (
        <div className="rounded-xl border border-border bg-white dark:bg-slate-900 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-border dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
            <h3 className="font-semibold text-sm">Verified Claim Memory ({verifiedClaims.length})</h3>
            <p className="text-xs text-muted">Atomic facts proven TRUE by authoritative citations.</p>
          </div>
          <div className="divide-y divide-border dark:divide-slate-700 max-h-[500px] overflow-y-auto">
            {verifiedClaims.length === 0 ? (
              <p className="p-6 text-sm text-center text-muted">NO DATA — Run investigations to accumulate verified claim memory.</p>
            ) : (
              verifiedClaims.map((c, i) => (
                <div key={i} className="p-4 text-xs space-y-1.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase text-muted">Source: {c.source}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
                      VERIFIED TRUE
                    </span>
                  </div>
                  <p className="font-semibold text-foreground">&quot;{c.claim}&quot;</p>
                  <p className="text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/60 p-2 rounded">
                    Evidence Citation: &quot;{c.evidence}&quot;
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Failed Claim Memory */}
      {activeTab === "failed_claims" && (
        <div className="rounded-xl border border-border bg-white dark:bg-slate-900 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-border dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
            <h3 className="font-semibold text-sm">Failed &amp; Contradicted Claim Memory ({failedClaims.length})</h3>
            <p className="text-xs text-muted">Known hallucination patterns and contradicted statements with root causes.</p>
          </div>
          <div className="divide-y divide-border dark:divide-slate-700 max-h-[500px] overflow-y-auto">
            {failedClaims.length === 0 ? (
              <p className="p-6 text-sm text-center text-muted">No failed claims in memory.</p>
            ) : (
              failedClaims.map((c, i) => (
                <div key={i} className="p-4 text-xs space-y-1.5 hover:bg-red-50/30 dark:hover:bg-red-950/20">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase text-red-600 font-semibold">{c.rootCause || "Hallucination"}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                      FAILED
                    </span>
                  </div>
                  <p className="font-semibold text-foreground">&quot;{c.claim}&quot;</p>
                  <p className="text-slate-600 dark:text-slate-400">Context: &quot;{c.query}&quot; ({c.domain} domain)</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: Evidence Memory */}
      {activeTab === "evidence_memory" && (
        <div className="rounded-xl border border-border bg-white dark:bg-slate-900 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-border dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
            <h3 className="font-semibold text-sm">Evidence Citation Frequency Memory ({evidenceCitations.length})</h3>
            <p className="text-xs text-muted">Authoritative citations and how frequently they are utilized in verifications.</p>
          </div>
          <div className="divide-y divide-border dark:divide-slate-700 max-h-[500px] overflow-y-auto">
            {evidenceCitations.length === 0 ? (
              <p className="p-6 text-sm text-center text-muted">No evidence citations recorded yet.</p>
            ) : (
              evidenceCitations.map((ev, i) => (
                <div key={i} className="p-4 text-xs space-y-1.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-accent">📄 {ev.source}</span>
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-mono text-[10px] font-semibold">
                      Used {ev.count} time(s)
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded border border-border dark:border-slate-800">
                    &quot;{ev.text}&quot;
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 6: Verification History */}
      {activeTab === "history" && (
        <div className="rounded-xl border border-border bg-white dark:bg-slate-900 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-border dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
            <h3 className="font-semibold text-sm">Chronological Verification History ({history.length})</h3>
            <p className="text-xs text-muted">Immutable history of all firewall investigation sessions.</p>
          </div>
          <div className="divide-y divide-border dark:divide-slate-700">
            {history.length === 0 ? (
              <p className="p-6 text-sm text-center text-muted">NO DATA — No verification records found.</p>
            ) : (
              history.map((h) => (
                <div key={h.id} className="p-4 text-xs space-y-2 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">&quot;{h.query}&quot;</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                        h.decision === "pass"
                          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                          : h.decision === "rewrite"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                      }`}
                    >
                      {h.decision}
                    </span>
                  </div>
                  <div className="text-muted flex gap-4 text-[11px]">
                    <span>Domain: <strong className="capitalize">{h.domain}</strong></span>
                    <span>Confidence: <strong>{Math.round(h.confidenceScore * 100)}%</strong></span>
                    <span>Claims: <strong>{h.claimsCount}</strong></span>
                    <span>Date: {new Date(h.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
