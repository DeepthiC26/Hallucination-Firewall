"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { loadVerificationSession } from "@/lib/safety/session"
import InvestigationJourney from "@/components/platform/InvestigationJourney"

interface CanonicalInvestigationRecord {
  id: string
  queryId: string
  timestamp: string
  query: string
  domain: string
  firewallDomain: string
  datasetId?: string
  datasetName?: string
  docId?: string
  docTitle?: string
  firewallEnabled: boolean
  user: string
  rawLlmResponse: string
  generatorModel?: string
  claims: Array<{
    id: string
    claim: string
    verdict: string
    status: string
    confidence: number
    similarity: number
    evidenceSource?: string
    sheet?: string
    row?: number
    page?: number
    columns?: string[]
    evidenceSnippet?: string
  }>
  evidence: Array<{
    documentName: string
    sourceFile?: string
    sheet?: string
    row?: number
    page?: number
    paragraph: string
    similarity: number
    relation?: string
    authorityLevel?: string
  }>
  contradictions: Array<{
    type: string
    claimText: string
    evidenceText: string
    note: string
    severity: string
  }>
  factScore: number
  confidenceScore: number
  trustScore: number
  riskScore: number
  decision: string
  decisionReason: string
  rewriteInfo?: {
    originalLlmResponse: string
    problematicClaims: string[]
    detectedErrors: string[]
    trustedEvidenceCitations: string[]
    correctedClaims: string[]
    rewrittenResponse: string
    reverificationPassed: boolean
    reverificationDetails: string
    finalDecision: string
  }
  finalDeliveredResponse: string
  responseTimeMs: number
}

interface BenchmarkReport {
  overallAccuracyPercent: number
  overallPrecision: number
  overallRecall: number
  overallF1Score: number
  overallFARPercent: number
  overallFRRPercent: number
  domainBreakdown: {
    healthcare: { accuracyPercent: number; precision: number; recall: number; f1Score: number }
    legal: { accuracyPercent: number; precision: number; recall: number; f1Score: number }
    enterprise: { accuracyPercent: number; precision: number; recall: number; f1Score: number }
  }
}

export default function ComprehensiveTrustReportPage() {
  const [record, setRecord] = useState<CanonicalInvestigationRecord | null>(null)
  const [allRecords, setAllRecords] = useState<CanonicalInvestigationRecord[]>([])
  const [benchmark, setBenchmark] = useState<BenchmarkReport | null>(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Fetch Audit log / investigations
      const auditRes = await fetch("/api/investigations")
      if (auditRes.ok) {
        const data = await auditRes.json()
        if (Array.isArray(data) && data.length > 0) {
          setAllRecords(data)
          setRecord(data[0])
        }
      }

      // 2. Fetch Benchmark Performance
      const benchRes = await fetch("/api/benchmark")
      if (benchRes.ok) {
        const benchData = await benchRes.json()
        setBenchmark(benchData)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Check if there is an active session
    const session = loadVerificationSession()
    if (session?.query) {
      // Load session
      const active: CanonicalInvestigationRecord = {
        id: "ACTIVE-SESSION",
        queryId: "ACTIVE-SESSION",
        timestamp: new Date().toISOString(),
        query: session.query,
        domain: session.firewallDomain || "enterprise",
        firewallDomain: session.firewallDomain || "enterprise",
        datasetName: session.docTitle,
        firewallEnabled: true,
        user: "active-user",
        rawLlmResponse: session.rawLlm || "",
        claims: (session.claims || []).map((c: any, i: number) => ({
          id: c.id || `claim-${i}`,
          claim: c.claim,
          verdict: c.verdict,
          status: c.status,
          confidence: c.confidence,
          similarity: c.similarity,
          evidenceSource: c.retrievedDocument,
          sheet: c.sheet,
          row: c.row,
          page: c.page,
          columns: c.columns,
          evidenceSnippet: c.paragraph,
        })),
        evidence: (session.evidence || []).map((ev: any) => ({
          documentName: ev.documentName,
          sourceFile: ev.sourceFile || ev.documentName,
          sheet: ev.sheet,
          row: ev.row,
          page: ev.page,
          paragraph: ev.paragraph,
          similarity: ev.similarity,
          relation: ev.relation || "supports",
        })),
        contradictions: [],
        factScore: session.factScore || 0,
        confidenceScore: session.confidence || 0,
        trustScore: Math.round((session.confidence || 0) * 100),
        riskScore: Math.round((1 - (session.confidence || 0)) * 100),
        decision: session.decision || "pass",
        decisionReason: session.reason || "Active verification record",
        finalDeliveredResponse: session.verifiedResponse || session.rawLlm || "",
        responseTimeMs: 0,
      }
      setRecord(active)
    }

    void loadData()
  }, [loadData])

  // Trust Governance calculations from real records
  const totalCount = allRecords.length
  const passCount = allRecords.filter((r) => r.decision === "pass").length
  const rewriteCount = allRecords.filter((r) => r.decision === "rewrite").length
  const blockCount = allRecords.filter((r) => r.decision === "block").length
  const totalClaims = allRecords.reduce((acc, r) => acc + r.claims.length, 0)
  const supportedClaims = allRecords.reduce(
    (acc, r) => acc + r.claims.filter((c) => c.verdict === "supported").length,
    0
  )
  const contradictedClaims = allRecords.reduce(
    (acc, r) => acc + r.claims.filter((c) => c.verdict === "contradicted").length,
    0
  )
  const avgConfidence = totalCount > 0
    ? Math.round((allRecords.reduce((acc, r) => acc + r.confidenceScore, 0) / totalCount) * 100)
    : 0

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Verification &amp; Trust Governance Report</h1>
          <p className="text-sm text-muted mt-1">
            Authoritative, traceable record of AI response verification grounded strictly in knowledge base evidence.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/verify"
            className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-semibold shadow-sm"
          >
            Verify New Query →
          </Link>
          <Link
            href="/dashboard/evaluation-metrics"
            className="text-xs px-3 py-1.5 rounded-lg border border-border bg-slate-100 text-slate-800 dark:bg-slate-800 dark:border-slate-700 font-medium"
          >
            Evaluation Metrics
          </Link>
          <Link
            href="/dashboard/audit-logs"
            className="text-xs px-3 py-1.5 rounded-lg border border-border dark:border-slate-700 font-medium"
          >
            Audit Trail
          </Link>
        </div>
      </div>

      <InvestigationJourney current="trust-report" />

      {/* Trust & Governance Summary (Derived strictly from real investigations) */}
      <div className="rounded-xl border border-border bg-white p-5 dark:bg-slate-900 dark:border-slate-700 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-widest text-muted">
            Trust &amp; Governance Metrics (Real Computed Data)
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
            {totalCount === 0 ? "NO DATA" : totalCount < 3 ? "INSUFFICIENT SAMPLE" : "ORGANIZATIONAL AGGREGATE"}
          </span>
        </div>

        {totalCount === 0 ? (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-center text-xs text-muted">
            NO DATA — Run queries in the Verification Console to generate empirical trust metrics.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-border bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[10px] text-muted uppercase block">Total Queries</span>
              <span className="text-lg font-bold text-foreground">{totalCount}</span>
            </div>
            <div className="p-3 rounded-lg border border-border bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[10px] text-muted uppercase block">Pass Decisions</span>
              <span className="text-lg font-bold text-green-600">{passCount} ({Math.round((passCount / totalCount) * 100)}%)</span>
            </div>
            <div className="p-3 rounded-lg border border-border bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[10px] text-muted uppercase block">Rewrites Corrected</span>
              <span className="text-lg font-bold text-amber-600">{rewriteCount} ({Math.round((rewriteCount / totalCount) * 100)}%)</span>
            </div>
            <div className="p-3 rounded-lg border border-border bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[10px] text-muted uppercase block">Blocks Enforced</span>
              <span className="text-lg font-bold text-red-600">{blockCount} ({Math.round((blockCount / totalCount) * 100)}%)</span>
            </div>
            <div className="p-3 rounded-lg border border-border bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[10px] text-muted uppercase block">Claims Verified</span>
              <span className="text-lg font-bold text-accent">{supportedClaims} / {totalClaims}</span>
            </div>
            <div className="p-3 rounded-lg border border-border bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[10px] text-muted uppercase block">Avg Confidence</span>
              <span className="text-lg font-bold text-foreground">{avgConfidence}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Measured Benchmark Performance */}
      {benchmark && (
        <div className="rounded-xl border border-border bg-white p-5 dark:bg-slate-900 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Measured Benchmark Accuracy &amp; Reliability</h3>
              <p className="text-xs text-muted">Empirical evaluation on labelled test sets across 3 enterprise domains.</p>
            </div>
            <span className="text-sm font-bold text-accent">{benchmark.overallAccuracyPercent}% Measured Accuracy</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800 border border-border">
              <span className="text-[10px] text-muted uppercase block">Precision</span>
              <span className="font-bold text-sm">{benchmark.overallPrecision}</span>
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800 border border-border">
              <span className="text-[10px] text-muted uppercase block">Recall</span>
              <span className="font-bold text-sm">{benchmark.overallRecall}</span>
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800 border border-border">
              <span className="text-[10px] text-muted uppercase block">F1 Score</span>
              <span className="font-bold text-sm">{benchmark.overallF1Score}</span>
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800 border border-border">
              <span className="text-[10px] text-muted uppercase block">False Accept Rate</span>
              <span className="font-bold text-sm text-green-600">{benchmark.overallFARPercent}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Authoritative Single Investigation Report */}
      {record ? (
        <div className="rounded-xl border border-border bg-white p-5 dark:bg-slate-900 dark:border-slate-700 space-y-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border dark:border-slate-800 pb-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted">Investigation Record</span>
              <h2 className="text-base font-bold text-foreground mt-0.5">&quot;{record.query}&quot;</h2>
              <p className="text-xs text-muted mt-1">
                Domain: <strong className="capitalize">{record.firewallDomain}</strong> · Dataset: <strong>{record.datasetName || "Knowledge Base"}</strong> · Timestamp: {new Date(record.timestamp).toLocaleString()}
              </p>
            </div>
            <span
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${
                record.decision === "pass"
                  ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                  : record.decision === "rewrite"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              Verdict: {record.decision}
            </span>
          </div>

          {/* Raw AI vs Verified Response */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900 space-y-2">
              <span className="text-xs font-mono uppercase tracking-widest text-amber-800 dark:text-amber-300 font-bold">
                WITHOUT FIREWALL (Raw LLM Response)
              </span>
              <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {record.rawLlmResponse || "—"}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-green-200 bg-green-50/40 dark:bg-green-950/20 dark:border-green-900 space-y-2">
              <span className="text-xs font-mono uppercase tracking-widest text-green-800 dark:text-green-300 font-bold">
                WITH FIREWALL (Verified Response)
              </span>
              <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {record.finalDeliveredResponse || record.rawLlmResponse || "—"}
              </p>
            </div>
          </div>

          {/* Atomic Claims & Evidence Provenance Table */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Extracted Atomic Claims &amp; Evidence Citations</h3>
            <div className="divide-y divide-border dark:divide-slate-700 border border-border dark:border-slate-700 rounded-lg overflow-hidden">
              {record.claims.map((c, i) => (
                <div key={i} className="p-3 text-xs space-y-1.5 bg-slate-50/30 dark:bg-slate-800/20">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">Claim #{i + 1}: &quot;{c.claim}&quot;</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      c.verdict === "supported"
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                        : c.verdict === "contradicted"
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}>
                      {c.verdict}
                    </span>
                  </div>

                  {c.evidenceSnippet && (
                    <div className="text-muted text-[11px] pl-2 border-l-2 border-accent/40 space-y-0.5">
                      <p>
                        Citation: <strong>{c.evidenceSource || "Dataset Source"}</strong>
                        {c.sheet ? ` · Sheet: ${c.sheet}` : ""}
                        {c.row != null ? ` · Row: ${c.row}` : ""}
                        {c.page != null ? ` · Page: ${c.page}` : ""}
                      </p>
                      <p className="italic text-slate-700 dark:text-slate-300">&quot;{c.evidenceSnippet}&quot;</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white p-8 text-center dark:bg-slate-900 dark:border-slate-700">
          <p className="text-sm text-muted">No investigation record selected. Run an investigation in the Verification Console.</p>
        </div>
      )}
    </div>
  )
}
