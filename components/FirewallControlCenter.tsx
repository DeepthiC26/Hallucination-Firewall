"use client"

import { useEffect, useRef, useState } from "react"
import type { FirewallDomain } from "@/types"

interface PipelineStageDisplay {
  id: string
  label: string
  status: "idle" | "active" | "complete" | "error" | "skipped"
  detail?: string
  subItems?: string[]
}

interface ClaimDisplay {
  claimId: string
  claim: string
  numericStatus?: string
  numericNote?: string
  dateStatus?: string
  dateNote?: string
  entityStatus?: string
  entityNote?: string
  verdict?: string
  confidence?: number
}

interface ControlCenterState {
  isActive: boolean
  queryId: string | null
  query: string
  domain: FirewallDomain | null
  firewallEnabled: boolean
  stages: PipelineStageDisplay[]
  claims: ClaimDisplay[]
  numericChecks: { checkedClaims: number; mismatches: number } | null
  dateChecks: { checkedClaims: number; mismatches: number } | null
  entityChecks: { checkedClaims: number; mismatches: number } | null
  domainVerification: { adjustedConfidence: number; evidenceFound: number; unsupportedClaims: string[] } | null
  decision: string | null
  confidenceScore: number | null
  trustScore: number | null
  reason: string | null
  rawLlmResponse: string | null
  finalResponse: string | null
  onInspect?: () => void
}

const PIPELINE_STAGES: Array<{ id: string; label: string; triggeredBy: string[] }> = [
  { id: "received", label: "Query Received", triggeredBy: ["received"] },
  { id: "domain_detection", label: "Domain Detection", triggeredBy: ["domain_detection"] },
  { id: "prompt_security", label: "Prompt Security", triggeredBy: ["prompt_security"] },
  { id: "evidence_retrieval", label: "Evidence Retrieval", triggeredBy: ["conflict_check"] },
  { id: "llm_response", label: "LLM Generation", triggeredBy: ["llm_response"] },
  { id: "claim_extraction", label: "Claim Extraction", triggeredBy: ["claim_extraction"] },
  { id: "evidence_matching", label: "Evidence Matching", triggeredBy: ["evidence_matching"] },
  { id: "numeric_check", label: "Numeric Consistency", triggeredBy: ["numeric_check"] },
  { id: "date_check", label: "Date Consistency", triggeredBy: ["date_check"] },
  { id: "entity_check", label: "Entity Consistency", triggeredBy: ["entity_check"] },
  { id: "domain_verification", label: "Domain Verification", triggeredBy: ["domain_verification"] },
  { id: "reliability", label: "Trust & Risk Score", triggeredBy: ["reliability"] },
  { id: "decision", label: "Firewall Decision", triggeredBy: ["decision"] },
  { id: "final_response", label: "Final Response", triggeredBy: ["final_response"] },
]

function buildInitialStages(): PipelineStageDisplay[] {
  return PIPELINE_STAGES.map((s) => ({ id: s.id, label: s.label, status: "idle" }))
}

function stageIdForEvent(eventStage: string): string | null {
  const found = PIPELINE_STAGES.find((s) => s.triggeredBy.includes(eventStage))
  return found?.id ?? null
}

interface Props {
  state: ControlCenterState
  onInspect: () => void
}

export default function FirewallControlCenter({ state, onInspect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [state.stages, state.claims])

  if (!state.isActive) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-border dark:border-slate-700 overflow-hidden">
        <div className="border-b border-border dark:border-slate-700 p-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Firewall Control Center</p>
          </div>
          <p className="text-xs text-slate-500 mt-1">Send a query to start real-time monitoring</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl mx-auto">
              🛡
            </div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Waiting for query…</p>
            <p className="text-xs text-slate-400 max-w-[220px]">
              Pipeline stages, claim verification, and decision results will appear here in real time
            </p>
          </div>
        </div>
      </div>
    )
  }

  const decisionColor =
    state.decision === "pass"
      ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"
      : state.decision === "rewrite"
        ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20"
        : state.decision === "block" || state.decision === "prompt_injection"
          ? "border-red-300 bg-red-50 dark:bg-red-950/20"
          : "border-border bg-slate-50 dark:bg-slate-800"

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-border dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="border-b border-border dark:border-slate-700 p-4 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${state.isActive && !state.decision ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">Firewall Control Center</p>
          {state.queryId && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border border-border">
              {state.queryId}
            </span>
          )}
          {state.domain && (
            <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border flex-shrink-0 ${
              state.domain === "healthcare" ? "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300" :
              state.domain === "legal" ? "border-purple-200 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300" :
              "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
            }`}>{state.domain}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {state.firewallEnabled ? (
            <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded font-bold">
              🟢 FIREWALL ON
            </span>
          ) : (
            <span className="text-[10px] bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 rounded font-bold">
              🔴 FIREWALL OFF
            </span>
          )}
          {state.decision && (
            <button
              onClick={onInspect}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white font-semibold hover:bg-slate-800 transition-colors"
            >
              Inspect ↗
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Firewall OFF Alert */}
        {!state.firewallEnabled && (
          <div className="rounded-xl border border-red-200 bg-red-50/70 dark:bg-red-950/20 dark:border-red-900/60 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-red-600 font-bold text-xs">🔴 FIREWALL OFF — UNVERIFIED AI RESPONSE</span>
            </div>
            <p className="text-[11px] text-red-700 dark:text-red-300">
              The AI response is delivered directly from the LLM without claim extraction, knowledge base retrieval, or contradiction checks.
            </p>
          </div>
        )}

        {/* Query */}
        {state.query && (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-border dark:border-slate-700 p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">Query</p>
            <p className="text-sm text-slate-800 dark:text-slate-200">{state.query}</p>
          </div>
        )}

        {/* Pipeline stages */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">Pipeline</p>
          <div className="space-y-1">
            {state.stages.map((stage, i) => (
              <div key={stage.id} className="flex items-start gap-2">
                <div className="flex flex-col items-center pt-0.5">
                  <StatusDot status={stage.status} />
                  {i < state.stages.length - 1 && (
                    <div className={`w-0.5 h-4 mt-0.5 rounded-full ${stage.status === "complete" ? "bg-emerald-300" : "bg-slate-200 dark:bg-slate-700"}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-xs font-medium ${
                      stage.status === "active" ? "text-blue-600 dark:text-blue-400" :
                      stage.status === "complete" ? "text-slate-700 dark:text-slate-300" :
                      stage.status === "error" ? "text-red-600" :
                      stage.status === "skipped" ? "text-slate-400" :
                      "text-slate-400 dark:text-slate-500"
                    }`}>
                      {stage.label}
                    </p>
                    {stage.status === "active" && (
                      <span className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  {stage.detail && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{stage.detail}</p>
                  )}
                  {stage.subItems && stage.subItems.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {stage.subItems.map((item, j) => (
                        <p key={j} className="text-[11px] text-slate-500 dark:text-slate-400">• {item}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Consistency Checks Summary */}
        {(state.numericChecks || state.dateChecks || state.entityChecks) && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">Consistency Checks</p>
            <div className="grid grid-cols-3 gap-2">
              {state.numericChecks && (
                <ConsistencyBadge label="Numeric" mismatches={state.numericChecks.mismatches} total={state.numericChecks.checkedClaims} />
              )}
              {state.dateChecks && (
                <ConsistencyBadge label="Dates" mismatches={state.dateChecks.mismatches} total={state.dateChecks.checkedClaims} />
              )}
              {state.entityChecks && (
                <ConsistencyBadge label="Entities" mismatches={state.entityChecks.mismatches} total={state.entityChecks.checkedClaims} />
              )}
            </div>
          </div>
        )}

        {/* Claims */}
        {state.claims.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">
              Claims ({state.claims.length})
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {state.claims.map((c) => (
                <div key={c.claimId} className="rounded-lg border border-border dark:border-slate-700 p-2 text-xs">
                  <p className="text-slate-800 dark:text-slate-200 line-clamp-2">{c.claim}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.numericStatus && c.numericStatus !== "not_applicable" && (
                      <CheckPill label="Num" status={c.numericStatus} note={c.numericNote} />
                    )}
                    {c.dateStatus && c.dateStatus !== "not_applicable" && (
                      <CheckPill label="Date" status={c.dateStatus} note={c.dateNote} />
                    )}
                    {c.entityStatus && c.entityStatus !== "not_applicable" && (
                      <CheckPill label="Entity" status={c.entityStatus} note={c.entityNote} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Domain Verification */}
        {state.domainVerification && (
          <div className="rounded-xl border border-border dark:border-slate-700 p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-2">Domain Verification</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-slate-500">Adj. Confidence</p>
                <p className="font-semibold">{Math.round(state.domainVerification.adjustedConfidence * 100)}%</p>
              </div>
              <div>
                <p className="text-slate-500">Evidence Grounded</p>
                <p className="font-semibold">{state.domainVerification.evidenceFound} claims</p>
              </div>
            </div>
            {state.domainVerification.unsupportedClaims.length > 0 && (
              <div className="mt-2 space-y-1">
                {state.domainVerification.unsupportedClaims.slice(0, 3).map((u, i) => (
                  <p key={i} className="text-[11px] text-amber-700 dark:text-amber-400">⚠ {u.replace("⚠ ", "")}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Final Decision */}
        {state.decision && (
          <div className={`rounded-xl border-2 p-4 ${decisionColor}`}>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-2">Firewall Decision</p>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <DecisionBadge decision={state.decision} />
                {state.reason && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">{state.reason}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                {state.confidenceScore != null && state.confidenceScore > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500">Confidence</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {Math.round(state.confidenceScore * 100)}%
                    </p>
                  </div>
                )}
                {state.trustScore != null && state.trustScore > 0 && (
                  <div className="mt-1">
                    <p className="text-[10px] text-slate-500">Trust</p>
                    <p className="text-sm font-semibold">{Math.round(state.trustScore * 100)}%</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: PipelineStageDisplay["status"] }) {
  if (status === "complete") return <div className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0 mt-0.5" />
  if (status === "active") return <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse flex-shrink-0 mt-0.5" />
  if (status === "error") return <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0 mt-0.5" />
  if (status === "skipped") return <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-600 flex-shrink-0 mt-0.5" />
  return <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0 mt-0.5" />
}

function ConsistencyBadge({ label, mismatches, total }: { label: string; mismatches: number; total: number }) {
  const ok = mismatches === 0
  return (
    <div className={`rounded-lg border px-2 py-1.5 text-center ${ok ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" : "border-amber-200 bg-amber-50 dark:bg-amber-950/20"}`}>
      <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${ok ? "text-emerald-700" : "text-amber-700"}`}>
        {ok ? "✓" : `${mismatches}⚠`}
      </p>
      <p className="text-[10px] text-slate-400">{total} checked</p>
    </div>
  )
}

function CheckPill({ label, status, note }: { label: string; status: string; note?: string }) {
  const color =
    status === "pass" ? "bg-green-100 text-green-700 border-green-200" :
    status === "mismatch" ? "bg-amber-100 text-amber-700 border-amber-200" :
    status === "missing" ? "bg-slate-100 text-slate-600 border-slate-200" :
    "bg-slate-100 text-slate-500 border-slate-200"
  return (
    <span
      title={note}
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${color}`}
    >
      {label}:{status === "pass" ? "✓" : status === "mismatch" ? "⚠" : "–"}
    </span>
  )
}

function DecisionBadge({ decision }: { decision: string }) {
  const isPass = decision === "pass"
  const isRewrite = decision === "rewrite"
  const isBlock = decision === "block" || decision === "prompt_injection"
  const cls = isPass
    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
    : isRewrite
      ? "bg-amber-100 text-amber-800 border-amber-300"
      : "bg-red-100 text-red-800 border-red-300"
  const label = isPass ? "✓ PASS" : isRewrite ? "✏ REWRITE" : "✗ BLOCK"
  return (
    <span className={`inline-block text-sm font-bold px-3 py-1 rounded-lg border uppercase ${cls}`}>
      {label}
    </span>
  )
}

// ─── Hook to build FirewallControlCenter state from SSE events ────────────────

export function useFirewallControlCenter() {
  const [state, setState] = useState<ControlCenterState>({
    isActive: false,
    queryId: null,
    query: "",
    domain: null,
    firewallEnabled: true,
    stages: buildInitialStages(),
    claims: [],
    numericChecks: null,
    dateChecks: null,
    entityChecks: null,
    domainVerification: null,
    decision: null,
    confidenceScore: null,
    trustScore: null,
    reason: null,
    rawLlmResponse: null,
    finalResponse: null,
  })

  const onQueryStart = (query: string, domain: FirewallDomain, firewallEnabled: boolean) => {
    setState({
      isActive: true,
      queryId: null,
      query,
      domain,
      firewallEnabled,
      stages: buildInitialStages(),
      claims: [],
      numericChecks: null,
      dateChecks: null,
      entityChecks: null,
      domainVerification: null,
      decision: null,
      confidenceScore: null,
      trustScore: null,
      reason: null,
      rawLlmResponse: null,
      finalResponse: null,
    })
  }

  const onStreamEvent = (eventStage: string, data: Record<string, unknown>) => {
    setState((prev) => {
      const next = { ...prev }
      if (data.queryId) {
        next.queryId = data.queryId as string
      }
      const stageId = stageIdForEvent(eventStage)

      // Update pipeline stages
      if (stageId) {
        next.stages = prev.stages.map((s) => {
          if (s.id === stageId) {
            return { ...s, status: "complete", detail: stageDetailFor(eventStage, data) }
          }
          if (s.status === "idle" && isBeforeStage(prev.stages, s.id, stageId)) {
            return { ...s, status: "complete" }
          }
          return s
        })
        // Mark next stage as active
        const stageIdx = next.stages.findIndex((s) => s.id === stageId)
        if (stageIdx >= 0 && stageIdx + 1 < next.stages.length) {
          next.stages = next.stages.map((s, i) =>
            i === stageIdx + 1 && s.status === "idle" ? { ...s, status: "active" } : s
          )
        }
      }

      // Populate specific data
      if (eventStage === "claim_verification_update") {
        const { claimId, claim, numeric, date, entity } = data as {
          claimId: string; claim: string;
          numeric: { status: string; note: string };
          date: { status: string; note: string };
          entity: { status: string; note: string };
        }
        const existing = next.claims.find((c) => c.claimId === claimId)
        if (existing) {
          next.claims = next.claims.map((c) =>
            c.claimId === claimId ? { ...c, numericStatus: numeric?.status, numericNote: numeric?.note, dateStatus: date?.status, dateNote: date?.note, entityStatus: entity?.status, entityNote: entity?.note } : c
          )
        } else {
          next.claims = [
            ...next.claims,
            {
              claimId,
              claim: claim as string,
              numericStatus: numeric?.status,
              numericNote: numeric?.note,
              dateStatus: date?.status,
              dateNote: date?.note,
              entityStatus: entity?.status,
              entityNote: entity?.note,
            },
          ]
        }
      }

      if (eventStage === "numeric_check") {
        next.numericChecks = {
          checkedClaims: data.checkedClaims as number,
          mismatches: data.mismatches as number,
        }
      }
      if (eventStage === "date_check") {
        next.dateChecks = {
          checkedClaims: data.checkedClaims as number,
          mismatches: data.mismatches as number,
        }
      }
      if (eventStage === "entity_check") {
        next.entityChecks = {
          checkedClaims: data.checkedClaims as number,
          mismatches: data.mismatches as number,
        }
      }
      if (eventStage === "domain_verification") {
        next.domainVerification = {
          adjustedConfidence: data.adjustedConfidence as number ?? 0,
          evidenceFound: data.evidenceFound as number ?? 0,
          unsupportedClaims: (data.unsupportedClaims as string[]) || [],
        }
      }
      if (eventStage === "llm_response") {
        next.rawLlmResponse = data.text as string
      }
      if (eventStage === "decision") {
        next.decision = data.decision as string
        next.confidenceScore = data.confidenceScore as number ?? null
        next.trustScore = (data.reliability as { trust?: { trustScore?: number } })?.trust?.trustScore ?? null
        next.reason = data.reason as string ?? null
        // Mark all prior stages complete
        next.stages = next.stages.map((s) =>
          s.status !== "complete" && s.id !== "final_response" ? { ...s, status: "complete" } : s
        )
      }
      if (eventStage === "final_response") {
        next.finalResponse = data.text as string
        if (data.rawLlmResponse) next.rawLlmResponse = data.rawLlmResponse as string
        next.decision = next.decision || (data.decision as string) || (prev.firewallEnabled ? "pass" : "bypass")
        next.confidenceScore = next.confidenceScore ?? (data.confidenceScore as number) ?? null
        // Mark all stages complete
        next.stages = next.stages.map((s) => ({ ...s, status: "complete" as const }))
      }
      if (eventStage === "firewall_disabled" || eventStage === "firewall_bypassed") {
        next.stages = next.stages.map((s) => {
          if (s.id === "received" || s.id === "domain_detection" || s.id === "llm_response") {
            return { ...s, status: "complete" }
          }
          if (s.id === "final_response") {
            return { ...s, status: "complete", detail: "Unverified raw response delivered" }
          }
          return { ...s, status: "skipped" as const, detail: "Bypassed (Firewall OFF)" }
        })
      }

      return next
    })
  }

  return { state, onQueryStart, onStreamEvent }
}

function stageDetailFor(eventStage: string, data: Record<string, unknown>): string | undefined {
  if (eventStage === "domain_detection") return `${data.firewallDomain} (${Math.round((data.confidence as number) * 100)}%)`
  if (eventStage === "prompt_security") return data.status as string
  if (eventStage === "claim_extraction") {
    const count = data.count as number
    return count ? `${count} claim${count !== 1 ? "s" : ""} extracted` : undefined
  }
  if (eventStage === "evidence_matching") return "Evidence analysed"
  if (eventStage === "numeric_check") return `${data.mismatches ?? 0} mismatch(es)`
  if (eventStage === "date_check") return `${data.mismatches ?? 0} mismatch(es)`
  if (eventStage === "entity_check") return `${data.mismatches ?? 0} mismatch(es)`
  if (eventStage === "domain_verification") return `Confidence adjusted to ${Math.round((data.adjustedConfidence as number) * 100)}%`
  if (eventStage === "decision") return data.decision as string
  return undefined
}

function isBeforeStage(stages: PipelineStageDisplay[], checkId: string, targetId: string): boolean {
  const checkIdx = stages.findIndex((s) => s.id === checkId)
  const targetIdx = stages.findIndex((s) => s.id === targetId)
  return checkIdx < targetIdx
}
