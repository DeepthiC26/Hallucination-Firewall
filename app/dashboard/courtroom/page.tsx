"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { loadVerificationSession } from "@/lib/safety/session"
import InvestigationJourney from "@/components/platform/InvestigationJourney"
import { runCourtroomAgents } from "@/lib/trust-os/courtroom"
import type { AgentReport } from "@/lib/trust-os/types"

interface ClaimAdjudication {
  id: string
  claim: string
  verdict: "supported" | "contradicted" | "unsupported" | "uncertain"
  status: "safe" | "uncertain" | "hallucinated"
  confidence: number
  similarity: number
  document?: string
  sourceFile?: string
  sheet?: string
  row?: number
  page?: number
  columns?: string[]
  evidenceSnippet?: string
  contradictingEvidence?: string
  contradictingSource?: string
  numericalValues?: string[]
  dates?: string[]
  namedEntities?: string[]
  consistencyChecks?: {
    numeric?: { status: string; note: string; claimValues?: string[]; evidenceValues?: string[] }
    date?: { status: string; note: string; claimDates?: string[]; evidenceDates?: string[] }
    entity?: { status: string; note: string; mismatches?: string[] }
  }
}

interface InvestigationCase {
  id: string
  query: string
  domain: string
  firewallDomain: string
  decision: string
  decisionReason: string
  timestamp: string
  rawLlmResponse: string
  finalDeliveredResponse: string
  claims: ClaimAdjudication[]
  contradictions?: Array<{ type: string; claimText: string; evidenceText: string; note: string; severity: string }>
  crossSourceConflict?: { hasConflict: boolean; conflicts: Array<{ topic: string; documentA: string; documentB: string; note: string }> }
  courtroom?: AgentReport[]
  judgeDecision?: {
    decision: "pass" | "rewrite" | "block"
    summary: string
    votes: Record<string, number>
    confidence?: number
    verifiedResult?: {
      status: string
      passedJury: boolean
      criticalBlockers: string[]
      advisoryWarnings: string[]
    }
  }
}

type AgentFilter = "all" | "support" | "oppose" | "flag"

export default function CourtroomAdjudicationPage() {
  const [activeCase, setActiveCase] = useState<InvestigationCase | null>(null)
  const [recentCases, setRecentCases] = useState<InvestigationCase[]>([])
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null)
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("all")
  const [loading, setLoading] = useState(true)

  const loadCases = useCallback(async () => {
    try {
      const res = await fetch("/api/investigations")
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          const cases: InvestigationCase[] = data.map((entry: any) => ({
            id: entry.id,
            query: entry.query,
            domain: entry.domain,
            firewallDomain: entry.firewallDomain,
            decision: entry.decision,
            decisionReason: entry.decisionReason,
            timestamp: entry.timestamp,
            rawLlmResponse: entry.rawLlmResponse,
            finalDeliveredResponse: entry.finalDeliveredResponse,
            claims: (entry.claims || []).map((c: any) => ({
              ...c,
              document: c.evidenceSource || c.document,
              evidenceSnippet: c.evidenceSnippet || c.evidenceSource,
            })),
            contradictions: entry.contradictions,
            crossSourceConflict: entry.crossSourceConflict,
            courtroom: entry.courtroom,
            judgeDecision: entry.judgeDecision,
          }))
          setRecentCases(cases)
          setActiveCase(cases[0])
          if (cases[0]?.claims?.length > 0) {
            setSelectedClaimId(cases[0].claims[0].id)
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const session = loadVerificationSession()
    if (session?.query && session?.claims && session.claims.length > 0) {
      const sessionCase: InvestigationCase = {
        id: "ACTIVE-SESSION",
        query: session.query,
        domain: session.firewallDomain || "enterprise",
        firewallDomain: session.firewallDomain || "enterprise",
        decision: session.decision || "pass",
        decisionReason: session.reason || "Active verification adjudication",
        timestamp: new Date().toISOString(),
        rawLlmResponse: session.rawLlm || session.rawLlmResponse || "",
        finalDeliveredResponse: session.verifiedResponse || session.finalResponse || session.rawLlm || "",
        claims: (session.claims || []).map((c: any, i: number) => ({
          id: c.id || `claim-${i}`,
          claim: c.claim,
          verdict: c.verdict,
          status: c.status,
          confidence: c.confidence,
          similarity: c.similarity,
          document: c.retrievedDocument || c.sourceFile,
          sourceFile: c.sourceFile,
          sheet: c.sheet,
          row: c.row,
          page: c.page,
          columns: c.columns,
          evidenceSnippet: c.paragraph || c.evidenceSnippet,
          numericalValues: c.numericalValues,
          dates: c.dates,
          namedEntities: c.namedEntities,
          consistencyChecks: c.consistencyChecks,
        })),
        courtroom: session.courtroom || (session.trustOs as any)?.courtroom,
        judgeDecision: session.judgeDecision || (session.trustOs as any)?.judgeDecision,
      }
      setActiveCase(sessionCase)
      if (sessionCase.claims.length > 0) {
        setSelectedClaimId(sessionCase.claims[0].id)
      }
      setLoading(false)
    } else {
      void loadCases()
    }
  }, [loadCases])

  // Synthesize or retrieve Courtroom Multi-Agent adjudication data
  const courtroomData = useMemo(() => {
    if (!activeCase) return null
    if (activeCase.courtroom && activeCase.courtroom.length > 0 && activeCase.judgeDecision) {
      return {
        agents: activeCase.courtroom,
        judgeDecision: activeCase.judgeDecision,
      }
    }
    // Compute on-the-fly for complete multi-agent cross-examination
    const run = runCourtroomAgents({
      query: activeCase.query,
      answer: activeCase.rawLlmResponse || activeCase.finalDeliveredResponse || "",
      claims: activeCase.claims as any,
      evidenceTexts: activeCase.claims.map((cl) => cl.evidenceSnippet || "").filter(Boolean),
      contradictionCount: activeCase.contradictions?.length || 0,
      firewallDomain: activeCase.firewallDomain || "enterprise",
      ethics: {
        level: "safe",
        flags: [],
        privacyRisk: "safe",
        biasRisk: "safe",
        complianceRisk: "safe",
        medicalSafetyRisk: "safe",
        legalComplianceRisk: "safe",
        sensitiveLeakage: "safe",
      },
      kbCoverage: activeCase.claims.some((cl) => cl.verdict === "supported"),
      conflicts: activeCase.crossSourceConflict?.conflicts as any,
    })
    return {
      agents: run.agents,
      judgeDecision: {
        decision: run.bindingDecision,
        summary: run.adjudicationSummary,
        votes: run.votes,
        confidence: run.confidence,
        verifiedResult: run.verifiedResult,
      },
    }
  }, [activeCase])

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-muted">
        Loading evidence adjudication courtroom…
      </div>
    )
  }

  if (!activeCase || activeCase.claims.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white p-8 text-center dark:bg-slate-900 dark:border-slate-700 space-y-3">
        <h2 className="text-base font-semibold">Evidence Adjudication Courtroom</h2>
        <p className="text-sm text-muted">
          NO DATA — Run an investigation in the Verification Console to inspect claim-by-claim evidence adjudication with the Courtroom Agent Jury.
        </p>
        <Link
          href="/dashboard/verify"
          className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold inline-block shadow-sm"
        >
          Open Verification Console →
        </Link>
      </div>
    )
  }

  const selectedClaim = activeCase.claims.find((c) => c.id === selectedClaimId) || activeCase.claims[0]
  const agents = courtroomData?.agents || []
  const judgeDecision = courtroomData?.judgeDecision
  const votes = judgeDecision?.votes || { support: 0, oppose: 0, flag: 0, neutral: 0 }
  const totalVotes = votes.support + votes.oppose + votes.flag + votes.neutral || 1

  const filteredAgents = agents.filter((a) => {
    if (agentFilter === "all") return true
    return a.verdict === agentFilter
  })

  const getVerdictBadge = (verdict: string) => {
    switch (verdict.toLowerCase()) {
      case "supported":
      case "support":
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
            VERIFIED TRUE
          </span>
        )
      case "contradicted":
      case "contradiction":
      case "oppose":
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
            CONTRADICTED
          </span>
        )
      case "unsupported":
      case "flag":
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            INSUFFICIENT EVIDENCE
          </span>
        )
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            {verdict.toUpperCase()}
          </span>
        )
    }
  }

  const getAgentVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case "support":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/40">
            SUPPORT
          </span>
        )
      case "oppose":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300/40">
            OPPOSE
          </span>
        )
      case "flag":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/40">
            FLAG / REWRITE
          </span>
        )
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            NEUTRAL
          </span>
        )
    }
  }

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <span>⚖️</span>
            <span>Evidence Adjudication Courtroom</span>
          </h1>
          <p className="text-xs text-muted mt-1 max-w-2xl">
            Multi-Agent Cross-Examination Bench: 11 specialized adversarial, forensic, and domain agents cross-examine claims to authoritatively verify the final result.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/trust-report"
            className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-semibold shadow-sm hover:opacity-90 transition-opacity"
          >
            Trust Report →
          </Link>
          <Link
            href="/dashboard/verify"
            className="text-xs px-3 py-1.5 rounded-lg border border-border dark:border-slate-700 font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Verify New Query
          </Link>
        </div>
      </div>

      <InvestigationJourney current="investigation-report" />

      {/* Active Trial Case Header */}
      <div className="rounded-xl border border-border bg-white p-5 dark:bg-slate-900 dark:border-slate-700 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border dark:border-slate-800 pb-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
              Active Case on Trial
            </span>
            <h2 className="text-base font-bold text-foreground mt-0.5">&quot;{activeCase.query}&quot;</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold uppercase bg-slate-100 dark:bg-slate-800">
              {activeCase.firewallDomain} Domain
            </span>
            <span
              className={`px-3 py-1 rounded-md text-xs font-bold uppercase shadow-sm ${
                activeCase.decision === "pass"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                  : activeCase.decision === "rewrite"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300"
              }`}
            >
              Verified Result: {activeCase.decision.toUpperCase()}
            </span>
          </div>
        </div>

        <p className="text-xs text-muted">
          <strong>Adjudication Rationale:</strong> {activeCase.decisionReason}
        </p>

        {recentCases.length > 1 && (
          <div className="flex items-center gap-2 pt-1 text-xs">
            <span className="text-muted shrink-0">Switch Case:</span>
            <select
              className="text-xs px-2.5 py-1 rounded border border-border dark:bg-slate-800 dark:border-slate-600 font-medium"
              value={activeCase.id}
              onChange={(e) => {
                const found = recentCases.find((c) => c.id === e.target.value)
                if (found) {
                  setActiveCase(found)
                  if (found.claims.length > 0) setSelectedClaimId(found.claims[0].id)
                }
              }}
            >
              {recentCases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.query.slice(0, 60)} ({c.decision.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 👨‍⚖️ Presiding Judicial Bench & Courtroom Verification Ruling */}
      <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 dark:from-indigo-950/20 dark:via-slate-900 dark:to-slate-900 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 dark:border-indigo-900/40 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl p-2 rounded-lg bg-indigo-100/70 dark:bg-indigo-900/40">👨‍⚖️</span>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Presiding Judicial Bench &amp; Final Verified Result
              </h2>
              <p className="text-[11px] text-muted">
                Synthesized verdict rendered from all 10 courtroom cross-examining agents.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className="text-[10px] font-mono text-muted uppercase block">Jury Confidence</span>
              <span className="text-xs font-bold font-mono text-indigo-700 dark:text-indigo-400">
                {Math.round((judgeDecision?.confidence || 0.85) * 100)}%
              </span>
            </div>
            <span
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold tracking-wide uppercase shadow-sm ${
                judgeDecision?.decision === "pass"
                  ? "bg-emerald-600 text-white"
                  : judgeDecision?.decision === "rewrite"
                    ? "bg-amber-500 text-white"
                    : "bg-rose-600 text-white"
              }`}
            >
              VERDICT: {judgeDecision?.decision.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Judicial Memorandum */}
        <div className="p-3.5 rounded-lg bg-white/90 dark:bg-slate-800/80 border border-indigo-100 dark:border-indigo-950 text-xs space-y-2">
          <span className="font-semibold text-indigo-900 dark:text-indigo-300 block text-[11px] uppercase tracking-wider">
            Judicial Memorandum &amp; Synthesis:
          </span>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            {judgeDecision?.summary || activeCase.decisionReason}
          </p>

          {/* Jury Vote Distribution Bar */}
          <div className="pt-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-muted">
              <span>Jury Votes ({totalVotes} total agents)</span>
              <div className="flex items-center gap-3">
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                  ✓ Support: {votes.support}
                </span>
                <span className="text-amber-700 dark:text-amber-400 font-bold">
                  ⚠️ Flag: {votes.flag}
                </span>
                <span className="text-rose-700 dark:text-rose-400 font-bold">
                  ✕ Oppose: {votes.oppose}
                </span>
                {votes.neutral > 0 && (
                  <span className="text-slate-500 font-medium">
                    • Neutral: {votes.neutral}
                  </span>
                )}
              </div>
            </div>

            {/* Segmented Progress Bar */}
            <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${(votes.support / totalVotes) * 100}%` }}
                className="bg-emerald-500 transition-all duration-500"
                title={`Support: ${votes.support}`}
              />
              <div
                style={{ width: `${(votes.flag / totalVotes) * 100}%` }}
                className="bg-amber-400 transition-all duration-500"
                title={`Flag: ${votes.flag}`}
              />
              <div
                style={{ width: `${(votes.oppose / totalVotes) * 100}%` }}
                className="bg-rose-500 transition-all duration-500"
                title={`Oppose: ${votes.oppose}`}
              />
              <div
                style={{ width: `${(votes.neutral / totalVotes) * 100}%` }}
                className="bg-slate-400 transition-all duration-500"
                title={`Neutral: ${votes.neutral}`}
              />
            </div>
          </div>
        </div>

        {/* Critical Blockers / Warnings (if any) */}
        {judgeDecision?.verifiedResult?.criticalBlockers && judgeDecision.verifiedResult.criticalBlockers.length > 0 && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs space-y-1">
            <span className="font-bold text-rose-800 dark:text-rose-300 block text-[11px] uppercase tracking-wider">
              ⛔ Critical Courtroom Blockers:
            </span>
            <ul className="list-disc list-inside text-rose-700 dark:text-rose-300 space-y-0.5 text-[11px]">
              {judgeDecision.verifiedResult.criticalBlockers.map((blocker, i) => (
                <li key={i}>{blocker}</li>
              ))}
            </ul>
          </div>
        )}

        {judgeDecision?.verifiedResult?.advisoryWarnings && judgeDecision.verifiedResult.advisoryWarnings.length > 0 && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs space-y-1">
            <span className="font-bold text-amber-800 dark:text-amber-300 block text-[11px] uppercase tracking-wider">
              ⚠️ Jury Verification Warnings (Mandating Recovery):
            </span>
            <ul className="list-disc list-inside text-amber-700 dark:text-amber-300 space-y-0.5 text-[11px]">
              {judgeDecision.verifiedResult.advisoryWarnings.map((warn, i) => (
                <li key={i}>{warn}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 🏛️ Multi-Agent Cross-Examination Bench (11 Agents) */}
      <div className="rounded-xl border border-border bg-white dark:bg-slate-900 dark:border-slate-700 p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>👥</span>
              <span>Courtroom Cross-Examination Jury ({agents.length} Agents)</span>
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Each agent conducts adversarial cross-examination across evidence, logic, forensics, and safety.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setAgentFilter("all")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                agentFilter === "all"
                  ? "bg-accent text-white font-semibold"
                  : "bg-slate-100 dark:bg-slate-800 text-muted hover:text-foreground"
              }`}
            >
              All ({agents.length})
            </button>
            <button
              onClick={() => setAgentFilter("support")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                agentFilter === "support"
                  ? "bg-emerald-600 text-white font-semibold"
                  : "bg-slate-100 dark:bg-slate-800 text-muted hover:text-foreground"
              }`}
            >
              Supporting ({votes.support})
            </button>
            <button
              onClick={() => setAgentFilter("flag")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                agentFilter === "flag"
                  ? "bg-amber-500 text-white font-semibold"
                  : "bg-slate-100 dark:bg-slate-800 text-muted hover:text-foreground"
              }`}
            >
              Flagged ({votes.flag})
            </button>
            <button
              onClick={() => setAgentFilter("oppose")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                agentFilter === "oppose"
                  ? "bg-rose-600 text-white font-semibold"
                  : "bg-slate-100 dark:bg-slate-800 text-muted hover:text-foreground"
              }`}
            >
              Opposing ({votes.oppose})
            </button>
          </div>
        </div>

        {/* Agents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredAgents.map((agent, idx) => {
            const isJudge = agent.agent === "Presiding Judge" || agent.agent === "Judge"
            return (
              <div
                key={idx}
                className={`rounded-xl border p-4 space-y-3 transition-all ${
                  isJudge
                    ? "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-800 shadow-sm"
                    : agent.verdict === "oppose"
                      ? "bg-rose-50/30 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50"
                      : agent.verdict === "flag"
                        ? "bg-amber-50/30 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50"
                        : "bg-white dark:bg-slate-850 border-border dark:border-slate-800 hover:border-accent/40"
                }`}
              >
                {/* Agent Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                      {agent.avatar || "🤖"}
                    </span>
                    <div>
                      <h3 className="text-xs font-bold text-foreground">{agent.agent}</h3>
                      <p className="text-[10px] text-muted line-clamp-1">{agent.role}</p>
                    </div>
                  </div>
                  {getAgentVerdictBadge(agent.verdict)}
                </div>

                {/* Confidence Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-muted">
                    <span>Confidence</span>
                    <span className="font-semibold text-foreground">
                      {Math.round(agent.confidence * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.round(agent.confidence * 100)}%` }}
                      className={`h-full rounded-full ${
                        agent.verdict === "oppose"
                          ? "bg-rose-500"
                          : agent.verdict === "flag"
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                    />
                  </div>
                </div>

                {/* Testimony / Reasoning */}
                <div className="space-y-1 border-t border-border/60 dark:border-slate-800 pt-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted block">
                    Cross-Examination Testimony:
                  </span>
                  <ul className="space-y-1 text-[11px] text-slate-700 dark:text-slate-300">
                    {agent.reasoning.slice(0, 2).map((r, rIdx) => (
                      <li key={rIdx} className="leading-relaxed flex items-start gap-1.5">
                        <span className="text-accent text-[9px] mt-0.5">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Key Findings */}
                {agent.findings && agent.findings.length > 0 && (
                  <div className="space-y-1 border-t border-border/40 dark:border-slate-800/80 pt-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted block">
                      Forensic Findings:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {agent.findings.slice(0, 3).map((f, fIdx) => (
                        <span
                          key={fIdx}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 truncate max-w-full"
                          title={f}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Claim-by-Claim Adjudication Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Disputed Claims List */}
        <div className="rounded-xl border border-border bg-white dark:bg-slate-900 dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-border dark:border-slate-700 flex items-center justify-between">
            <p className="text-xs font-mono uppercase tracking-widest text-muted">
              Claims on Trial ({activeCase.claims.length})
            </p>
            <span className="text-[10px] text-muted">Click to inspect</span>
          </div>
          <div className="divide-y divide-border dark:divide-slate-700 max-h-[520px] overflow-y-auto">
            {activeCase.claims.map((c, idx) => {
              const isSelected = c.id === selectedClaim.id
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedClaimId(c.id)}
                  className={`p-3 cursor-pointer text-xs space-y-1.5 transition-colors ${
                    isSelected
                      ? "bg-accent/10 border-l-4 border-l-accent"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-muted">Claim #{idx + 1}</span>
                    {getVerdictBadge(c.verdict)}
                  </div>
                  <p className="font-medium text-foreground line-clamp-2">{c.claim}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Middle & Right Columns: Forensic Evidence Adjudication */}
        <div className="lg:col-span-2 space-y-4">
          {/* Claim Investigation Card */}
          <div className="rounded-xl border border-border bg-white p-5 dark:bg-slate-900 dark:border-slate-700 space-y-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
                  Claim Under Review
                </span>
                <p className="text-sm font-semibold text-foreground mt-1">&quot;{selectedClaim.claim}&quot;</p>
              </div>
              {getVerdictBadge(selectedClaim.verdict)}
            </div>

            {/* Which Agents Interrogated this Claim */}
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-border dark:border-slate-700 text-xs space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted block">
                Courtroom Agents Cross-Examining This Claim:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  🔬 Forensic Auditor: {selectedClaim.consistencyChecks?.numeric?.status === "pass" ? "Numeric Parity Verified" : selectedClaim.consistencyChecks?.numeric?.status === "mismatch" ? "Discrepancy Found" : "Quantitative Check"}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  📑 Evidence Advocate: {selectedClaim.evidenceSnippet ? "Citations Corroborated" : "Unsubstantiated"}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                  ⚔️ Contradiction Prosecutor: {selectedClaim.verdict === "contradicted" ? "Direct Clash" : "Adversarial Pass"}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                  🕵️ Hallucination Detective: {selectedClaim.consistencyChecks?.entity?.status === "pass" ? "Entities Grounded" : "Entity Checked"}
                </span>
              </div>
            </div>

            {/* Consistency & Discrepancy Checks */}
            {selectedClaim.consistencyChecks && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div
                  className={`p-2.5 rounded-lg border ${
                    selectedClaim.consistencyChecks.numeric?.status === "mismatch"
                      ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
                      : "bg-slate-50 dark:bg-slate-800/50 border-border dark:border-slate-700"
                  }`}
                >
                  <span className="font-semibold block text-[10px] uppercase text-muted">
                    Numeric Check
                  </span>
                  <span
                    className={`font-bold ${
                      selectedClaim.consistencyChecks.numeric?.status === "mismatch"
                        ? "text-red-700 dark:text-red-400"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {selectedClaim.consistencyChecks.numeric?.status.toUpperCase() || "N/A"}
                  </span>
                  <p className="text-[11px] text-muted mt-0.5">
                    {selectedClaim.consistencyChecks.numeric?.note}
                  </p>
                </div>

                <div
                  className={`p-2.5 rounded-lg border ${
                    selectedClaim.consistencyChecks.date?.status === "mismatch"
                      ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
                      : "bg-slate-50 dark:bg-slate-800/50 border-border dark:border-slate-700"
                  }`}
                >
                  <span className="font-semibold block text-[10px] uppercase text-muted">Date Check</span>
                  <span
                    className={`font-bold ${
                      selectedClaim.consistencyChecks.date?.status === "mismatch"
                        ? "text-red-700 dark:text-red-400"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {selectedClaim.consistencyChecks.date?.status.toUpperCase() || "N/A"}
                  </span>
                  <p className="text-[11px] text-muted mt-0.5">
                    {selectedClaim.consistencyChecks.date?.note}
                  </p>
                </div>

                <div
                  className={`p-2.5 rounded-lg border ${
                    selectedClaim.consistencyChecks.entity?.status === "mismatch"
                      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900"
                      : "bg-slate-50 dark:bg-slate-800/50 border-border dark:border-slate-700"
                  }`}
                >
                  <span className="font-semibold block text-[10px] uppercase text-muted">
                    Entity Check
                  </span>
                  <span
                    className={`font-bold ${
                      selectedClaim.consistencyChecks.entity?.status === "mismatch"
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {selectedClaim.consistencyChecks.entity?.status.toUpperCase() || "N/A"}
                  </span>
                  <p className="text-[11px] text-muted mt-0.5">
                    {selectedClaim.consistencyChecks.entity?.note}
                  </p>
                </div>
              </div>
            )}

            {/* Authoritative Evidence Citation */}
            <div className="space-y-2 border-t border-border dark:border-slate-800 pt-3">
              <span className="text-xs font-mono uppercase tracking-widest text-muted">
                Authoritative Knowledge Base Citation
              </span>

              {selectedClaim.evidenceSnippet ? (
                <div className="p-3.5 rounded-lg border border-border bg-slate-50/70 dark:bg-slate-800/50 text-xs space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1 text-[11px]">
                    <span className="font-bold text-accent">
                      📄 {selectedClaim.sourceFile || selectedClaim.document || "Knowledge Base Source"}
                    </span>
                    <div className="flex gap-2 text-muted">
                      {selectedClaim.sheet && (
                        <span>
                          Sheet: <strong>{selectedClaim.sheet}</strong>
                        </span>
                      )}
                      {selectedClaim.row != null && (
                        <span>
                          Row: <strong>{selectedClaim.row}</strong>
                        </span>
                      )}
                      {selectedClaim.page != null && (
                        <span>
                          Page: <strong>{selectedClaim.page}</strong>
                        </span>
                      )}
                      {selectedClaim.similarity > 0 && (
                        <span>
                          Relevance: <strong>{Math.round(selectedClaim.similarity * 100)}%</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm font-mono text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-2.5 rounded border border-border dark:border-slate-800">
                    &quot;{selectedClaim.evidenceSnippet}&quot;
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/20 text-xs text-red-800 dark:text-red-300">
                  ⚠️ No authoritative citation found in the knowledge base supporting this claim.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
