"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { loadVerificationSession, type StoredVerification } from "@/lib/safety/session"
import {
  buildInvestigationReport,
  hallucinationLabel,
  outcomeLabel,
  type InvestigationReport,
} from "@/lib/investigation-report"
import InvestigationJourney from "@/components/platform/InvestigationJourney"
import type { DecisionValidationPayload, SafetyPlatformReport } from "@/types"

function outcomeStyle(outcome: string) {
  if (outcome === "verified")
    return "border-green-200 bg-green-50 text-green-900 dark:bg-green-950/30 dark:border-green-800"
  if (outcome === "partially_verified")
    return "border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800"
  return "border-red-200 bg-red-50 text-red-900 dark:bg-red-950/30 dark:border-red-800"
}

function segmentStyle(status: string) {
  if (status === "verified")
    return "bg-green-100/80 dark:bg-green-900/40 underline decoration-green-600 decoration-2"
  if (status === "contradicted")
    return "bg-red-100/80 dark:bg-red-900/40 line-through decoration-red-600"
  if (status === "unsupported")
    return "bg-amber-100/80 dark:bg-amber-900/40 underline decoration-amber-600 decoration-wavy"
  return ""
}

export default function InvestigationReportPage() {
  const [session, setSession] = useState<StoredVerification | null>(null)
  const [record, setRecord] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id")
    if (id) {
      fetch(`/api/investigations/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          setRecord(data)
          setLoading(false)
        })
        .catch(() => {
          setSession(loadVerificationSession())
          setLoading(false)
        })
    } else {
      setSession(loadVerificationSession())
      setLoading(false)
    }
  }, [])

  const report: InvestigationReport | null = useMemo(() => {
    if (record) {
      return buildInvestigationReport({
        query: record.query,
        firewallDomain: record.firewallDomain,
        decision: record.decision,
        reason: record.decisionReason,
        rawLlmResponse: record.rawLlmResponse,
        finalResponse: record.finalDeliveredResponse,
        claims: record.claims?.map((c: any) => ({
          id: c.id,
          claim: c.claim,
          category: c.category,
          supportStatus:
            c.verdict === "supported"
              ? "fully_supported"
              : c.verdict === "contradicted"
                ? "contradicted"
                : "unsupported",
          evidenceFound: !!c.evidenceSnippet,
          retrievedDocument: c.evidenceSource || c.datasetName || c.sourceFile,
          paragraph: c.evidenceSnippet,
          page: c.page,
          section: c.sheet || c.row ? `Sheet ${c.sheet} Row ${c.row}` : undefined,
          numericalValues: c.numericalValues,
          dates: c.dates,
        })),
        claimInvestigations: record.claims?.map((c: any) => {
          return {
            id: c.id,
            claim: c.claim,
            decision:
              c.verdict === "supported"
                ? "pass"
                : c.verdict === "contradicted"
                  ? "block"
                  : "rewrite",
            supportingEvidence:
              c.verdict === "supported" && c.evidenceSnippet ? [c.evidenceSnippet] : [],
            contradictingEvidence:
              c.verdict === "contradicted" && c.evidenceSnippet ? [c.evidenceSnippet] : [],
            retrievedDocuments: c.evidenceSource ? [c.evidenceSource] : [],
            retrievedPages: c.page ? [c.page] : [],
            why: c.reasoningPath?.[0] || "Evidence evaluated",
          }
        }),
        timestamp: record.timestamp,
      })
    }

    if (!session) return null
    if (session.investigationReport) {
      return session.investigationReport as InvestigationReport
    }
    const safety = session.safety as SafetyPlatformReport | undefined
    const dv = session.decisionValidation as DecisionValidationPayload | undefined
    return buildInvestigationReport({
      query: session.query,
      firewallDomain: session.firewallDomain,
      decision: session.decision,
      reason: session.reason,
      rawLlmResponse: session.rawLlmResponse || session.rawLlm || "",
      finalResponse: session.finalResponse || session.verifiedResponse || "",
      claims: safety?.claims,
      claimInvestigations: dv?.claimInvestigations,
      reasoningIntelligence: session.reasoningIntelligence as Parameters<
        typeof buildInvestigationReport
      >[0]["reasoningIntelligence"],
      decisionIntelligence: session.decisionIntelligence as Parameters<
        typeof buildInvestigationReport
      >[0]["decisionIntelligence"],
      decisionValidation: dv,
      timestamp: session.timestamp,
    })
  }, [session, record])

  if (loading) {
    return (
      <div className="space-y-4">
        <InvestigationJourney current="investigation-report" />
        <div className="rounded-xl border border-border bg-white p-8 text-center dark:bg-slate-900 dark:border-slate-700">
          <p className="text-sm text-muted">Loading investigation report...</p>
        </div>
      </div>
    )
  }

  if ((!session && !record) || !report) {
    return (
      <div className="space-y-4">
        <InvestigationJourney current="investigation-report" />
        <div className="rounded-xl border border-border bg-white p-8 text-center dark:bg-slate-900 dark:border-slate-700">
          <p className="text-sm text-muted">No investigation report yet.</p>
          <p className="text-xs text-muted mt-1">
            Complete a verification — the report reconstructs measurable results only.
          </p>
          <Link href="/dashboard/verify" className="text-accent text-sm underline mt-3 inline-block">
            Open Verification Console
          </Link>
        </div>
      </div>
    )
  }

  const verdict = report.finalDecision.verdict.toUpperCase()

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">AI Investigation Report</h1>
          <p className="text-sm text-muted mt-1">
            Centrepiece of the investigation — why the firewall trusted or rejected the answer,
            reconstructed from verification data (not regenerated by an LLM).
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href="/dashboard/trust-report"
            className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-semibold"
          >
            Trust & Governance →
          </Link>
          <Link
            href="/dashboard/verify"
            className="text-xs px-3 py-1.5 rounded-lg border border-border dark:border-slate-700"
          >
            ← Verification
          </Link>
        </div>
      </div>

      <InvestigationJourney current="investigation-report" />

      {/* Header / verdict */}
      <div className="rounded-xl border border-border bg-white p-4 dark:bg-slate-900 dark:border-slate-700">
        <p className="text-xs text-muted">User question</p>
        <p className="font-medium mt-1">{report.query}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex px-3 py-1 rounded-lg text-xs font-bold uppercase ${
              verdict === "PASS"
                ? "bg-green-500 text-white"
                : verdict === "REWRITE"
                  ? "bg-amber-500 text-white"
                  : "bg-red-600 text-white"
            }`}
          >
            Trust Verdict: {verdict}
          </span>
          {report.firewallDomain && (
            <span className="text-xs text-muted capitalize">{report.firewallDomain} domain</span>
          )}
          <span className="text-[10px] font-mono text-muted">
            Reproducible · {new Date(report.generatedAt).toLocaleString()}
          </span>
        </div>
        <p className="text-xs text-muted mt-2">{report.summaryLine}</p>
      </div>

      {/* 6.5 Timeline */}
      <section className="rounded-xl border border-border bg-white p-4 dark:bg-slate-900 dark:border-slate-700">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted mb-4">
          Investigation Timeline
        </h2>
        <ol className="space-y-3">
          {report.timeline.map((t, i) => (
            <li key={i} className="relative pl-6 border-l border-border dark:border-slate-700 ml-1">
              <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-accent/80" />
              <p className="text-sm font-semibold">{t.stage}</p>
              <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-muted">
                <p>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Input:</span>{" "}
                  {t.input}
                </p>
                <p>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Investigation:
                  </span>{" "}
                  {t.investigation}
                </p>
                <p>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Result:</span>{" "}
                  {t.result}
                </p>
                <p>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Next:</span>{" "}
                  {t.nextAction}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 6.6 Response Evolution */}
      <section className="rounded-xl border border-border bg-white p-4 dark:bg-slate-900 dark:border-slate-700 space-y-4">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted">
          Response Evolution
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 dark:bg-amber-950/20 dark:border-amber-800">
            <p className="text-[10px] font-mono uppercase text-amber-800 dark:text-amber-300 mb-2">
              1. Original AI Response
            </p>
            <p className="text-[10px] text-muted mb-2">Unmodified — never edited by the firewall</p>
            <p className="text-sm whitespace-pre-wrap">{report.responseEvolution.original}</p>
          </div>
          <div className="rounded-lg border border-border p-3 dark:border-slate-700">
            <p className="text-[10px] font-mono uppercase text-muted mb-2">
              2. Investigated Response
            </p>
            <p className="text-[10px] text-muted mb-2">
              <span className="text-green-700">Verified</span> ·{" "}
              <span className="text-amber-700">Unsupported</span> ·{" "}
              <span className="text-red-700">Contradicted</span>
            </p>
            <p className="text-sm leading-relaxed">
              {report.responseEvolution.investigated.map((seg, i) => (
                <span
                  key={i}
                  className={segmentStyle(seg.status)}
                  title={seg.note || seg.status}
                >
                  {seg.text}
                </span>
              ))}
            </p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50/40 p-3 dark:bg-green-950/20 dark:border-green-800">
            <p className="text-[10px] font-mono uppercase text-green-800 dark:text-green-300 mb-2">
              3. Verified Response
            </p>
            <p className="text-[10px] text-muted mb-2">
              Only unsupported claims changed; verified text preserved
            </p>
            <p className="text-sm whitespace-pre-wrap">{report.responseEvolution.verified}</p>
          </div>
        </div>
      </section>

      {/* 6.4 Q2–Q5 Claim investigations */}
      <section className="rounded-xl border border-border bg-white p-4 dark:bg-slate-900 dark:border-slate-700">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted mb-1">
          Claim Investigations
        </h2>
        <p className="text-[11px] text-muted mb-4">
          Each factual statement was investigated independently — not as one paragraph.
        </p>
        <div className="space-y-4">
          {report.claimsInvestigated.map((c) => (
            <article
              key={c.claimId}
              className={`rounded-lg border p-3 ${outcomeStyle(c.outcome)}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-mono uppercase opacity-70">
                    {c.claimId}
                    {c.category ? ` · ${c.category.replace(/_/g, " ")}` : ""}
                  </p>
                  <p className="font-medium text-sm mt-0.5">{c.claim}</p>
                </div>
                <span className="text-[10px] font-bold uppercase shrink-0">
                  {outcomeLabel(c.outcome)}
                </span>
              </div>
              <p className="text-xs mt-2">{c.outcomeReason}</p>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                {(["supporting", "contradicting", "missing"] as const).map((role) => {
                  const items = c.evidence.filter((e) => e.role === role)
                  if (!items.length && role === "missing") return null
                  return (
                    <div key={role}>
                      <p className="font-semibold capitalize mb-1">
                        {role === "missing" ? "Missing evidence" : `${role} evidence`}
                      </p>
                      {items.length ? (
                        items.map((e, i) => (
                          <div key={i} className="mb-2 opacity-90">
                            <p className="font-medium">
                              {e.documentName}
                              {e.page != null ? ` · p.${e.page}` : ""}
                              {e.section ? ` · ${e.section}` : ""}
                            </p>
                            <p className="italic">“{e.sentence}”</p>
                            {e.note && <p className="opacity-70">{e.note}</p>}
                          </div>
                        ))
                      ) : (
                        <p className="opacity-60">None recorded</p>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-3 text-[11px] border-t border-black/10 dark:border-white/10 pt-2 space-y-1">
                <p className="font-semibold">How evidence was evaluated</p>
                <p>Sufficiency: {c.evaluation.sufficientEvidence ? "Yes" : "No"}</p>
                <p>Quality: {c.evaluation.evidenceQuality}</p>
                <p>
                  Conflicting documents: {c.evaluation.conflictingDocuments ? "Yes" : "No"}
                </p>
                {c.evaluation.domainPolicyAffected && (
                  <p>Domain policy influenced this claim&apos;s outcome.</p>
                )}
                {c.evaluation.details.map((d, i) => (
                  <p key={i} className="opacity-80">
                    • {d}
                  </p>
                ))}
              </div>

              {c.hallucinationClass !== "none" && (
                <p className="mt-2 text-[11px] font-semibold">
                  Hallucination class: {hallucinationLabel(c.hallucinationClass)} —{" "}
                  <span className="font-normal">{c.hallucinationExplanation}</span>
                </p>
              )}
            </article>
          ))}
          {!report.claimsInvestigated.length && (
            <p className="text-sm text-muted">No factual claims were extracted for investigation.</p>
          )}
        </div>
      </section>

      {/* 6.7 Hallucination classification summary */}
      {report.hallucinations.length > 0 && (
        <section className="rounded-xl border border-border bg-white p-4 dark:bg-slate-900 dark:border-slate-700">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted mb-3">
            Hallucination Classification
          </h2>
          <div className="space-y-2">
            {report.hallucinations.map((h) => (
              <div
                key={h.claimId}
                className="rounded-lg border border-red-200 bg-red-50/40 p-3 text-xs dark:bg-red-950/20 dark:border-red-800"
              >
                <p className="font-bold uppercase text-[10px] tracking-wide">
                  {hallucinationLabel(h.classification)}
                </p>
                <p className="mt-1 font-medium">{h.claim}</p>
                <p className="mt-1 text-muted">{h.explanation}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6.4 Q6 Final decision */}
      <section className="rounded-xl border border-border bg-white p-4 dark:bg-slate-900 dark:border-slate-700 space-y-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted">
          Why the Final Decision Was Taken
        </h2>
        <p className="text-sm">{report.finalDecision.why}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
          <div>
            <p className="font-semibold text-green-800 dark:text-green-300 mb-1">
              Claims accepted
            </p>
            {report.finalDecision.claimsAccepted.length ? (
              report.finalDecision.claimsAccepted.map((c, i) => (
                <p key={i} className="text-muted mb-1">
                  • {c}
                </p>
              ))
            ) : (
              <p className="text-muted">None</p>
            )}
          </div>
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">
              Claims corrected
            </p>
            {report.finalDecision.claimsCorrected.length ? (
              report.finalDecision.claimsCorrected.map((c, i) => (
                <p key={i} className="text-muted mb-1">
                  • {c}
                </p>
              ))
            ) : (
              <p className="text-muted">None</p>
            )}
          </div>
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300 mb-1">
              Claims that caused blocking
            </p>
            {report.finalDecision.claimsBlocked.length ? (
              report.finalDecision.claimsBlocked.map((c, i) => (
                <p key={i} className="text-muted mb-1">
                  • {c}
                </p>
              ))
            ) : (
              <p className="text-muted">None</p>
            )}
          </div>
        </div>
        {(report.finalDecision.rulesInfluencing.length > 0 ||
          report.finalDecision.unresolvedRisks.length > 0) && (
          <div className="text-[11px] border-t border-border pt-3 dark:border-slate-700 space-y-1">
            {report.finalDecision.rulesInfluencing.length > 0 && (
              <p>
                <span className="font-semibold">Rules that influenced the outcome:</span>{" "}
                {report.finalDecision.rulesInfluencing.join("; ")}
              </p>
            )}
            {report.finalDecision.unresolvedRisks.length > 0 && (
              <p>
                <span className="font-semibold">Unresolved risks:</span>{" "}
                {report.finalDecision.unresolvedRisks.join("; ")}
              </p>
            )}
          </div>
        )}
        <p className="text-[10px] text-muted pt-2">
          This report was reconstructed from structured verification outputs. Identical inputs
          always produce this same report.
        </p>
      </section>
    </div>
  )
}
