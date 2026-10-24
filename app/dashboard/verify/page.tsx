"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { saveVerificationSession } from "@/lib/safety/session"
import {
  LIVE_INVESTIGATION_STAGES,
  liveStageIndexFromSse,
} from "@/lib/investigation-experience"
import InvestigationJourney from "@/components/platform/InvestigationJourney"
import ResponseComparison from "@/components/platform/ResponseComparison"
import type { Decision, SafetyPlatformReport, SSEEvent } from "@/types"

type SimulationCategoryOption =
  | "auto"
  | "unsupported_fact"
  | "contradicted_fact"
  | "unsupported_inference"
  | "numerical_hallucination"
  | "temporal_hallucination"
  | "policy_hallucination"
  | "fabricated_reference"
  | "context_hallucination"


interface DocOption {
  id: string
  title: string
  filename: string
  domain: string
  isDataset?: boolean
  datasetName?: string
  status?: string
  sourceFiles?: Array<{ id: string; filename: string; fileType?: string; sheets?: Array<{ name: string }>; totalRows?: number; pages?: number }>
  chunks?: number
}

interface LiveClaim {
  id: string
  claim: string
  category?: string
  investigationStatus?: string
  investigationStatusLabel?: string
  verdict?: string
  supportStatus?: string
  similarity?: number
  retrievedDocument?: string
  decomposedFromComposite?: boolean
  numericalValues?: string[]
  legalSections?: string[]
  medicalTerms?: string[]
}

const PIPELINE = LIVE_INVESTIGATION_STAGES.map((s) => s.label)

function claimStatusStyle(status?: string): string {
  switch (status) {
    case "verified":
      return "border-green-300 bg-green-50 text-green-800 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300"
    case "contradicted":
    case "blocked":
      return "border-red-300 bg-red-50 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300"
    case "rewritten":
      return "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200"
    case "evidence_retrieved":
    case "under_verification":
      return "border-sky-300 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-200"
    case "waiting_for_evidence":
    default:
      return "border-border bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300"
  }
}

function categoryLabel(cat?: string): string {
  if (!cat) return "Claim"
  return cat
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export default function VerifyConsolePage() {
  const router = useRouter()
  const [docs, setDocs] = useState<DocOption[]>([])
  const [docId, setDocId] = useState("")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [asked, setAsked] = useState(false)
  const [stageIdx, setStageIdx] = useState(-1)
  const [rawLlm, setRawLlm] = useState("")
  const [finalResponse, setFinalResponse] = useState("")
  const [generatorModel, setGeneratorModel] = useState("")
  const [crossVerifier, setCrossVerifier] = useState<{
    enabled: boolean
    model: string
    suspectedIssues: string[]
    suggestedFocus: string[]
    agreementHint: string
    note: string
  } | null>(null)
  const [firewallCore, setFirewallCore] = useState<{
    decision?: {
      trustVerdictLabel?: string
      actionLabel?: string
      reason?: string
    }
    inferences?: Array<{
      claimId: string
      verdict: string
      conclusionJustified?: boolean
      explanation?: string
      errors?: string[]
    }>
    policy?: {
      compliant?: boolean
      triggers?: string[]
      ethicsLevel?: string
      medicalUnsafe?: boolean
    }
    investigation?: { rootCauses?: string[] }
    recovery?: { detail?: string }
  } | null>(null)
  const [evidence, setEvidence] = useState<
    Array<{
      documentName: string
      datasetName?: string
      sourceFile?: string
      fileType?: string
      sheet?: string
      row?: number
      columns?: string[]
      page?: number
      section?: string
      paragraph: string
      similarity: number
      relation?: string
      authorityLevel?: string
      reason?: string
      claimId?: string
      claimSnippet?: string
      sufficientForClaim?: boolean
    }>
  >([])
  const [evidenceSummary, setEvidenceSummary] = useState("")
  const [decision, setDecision] = useState<Decision | undefined>()
  const [reason, setReason] = useState("")
  const [safety, setSafety] = useState<SafetyPlatformReport | undefined>()
  const [confidence, setConfidence] = useState<number | undefined>()
  const [error, setError] = useState("")
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [validationStages, setValidationStages] = useState<
    Array<{ label: string; verdict: string; detail: string }>
  >([])
  const [engineReason, setEngineReason] = useState("")
  const [liveClaims, setLiveClaims] = useState<LiveClaim[]>([])
  const [claimIntelSummary, setClaimIntelSummary] = useState("")
  const [decisionDetailsOpen, setDecisionDetailsOpen] = useState(false)
  const [decisionIntel, setDecisionIntel] = useState<{
    reason?: string
    severity?: string
    rulesFired?: string[]
    checklist?: Array<{
      id: string
      question: string
      answer: string
      detail: string
      severity: string
    }>
    justification?: {
      claimsPassed?: string[]
      claimsFailed?: string[]
      evidenceSupporting?: string[]
      documentsContradicting?: string[]
      policyRulesInfluencing?: string[]
      primaryCause?: string
      correctionsApplied?: string
      confidenceNote?: string
      rootCauses?: string[]
    }
  } | null>(null)
  const [handoffToReport, setHandoffToReport] = useState(false)
  const [adaptiveHint, setAdaptiveHint] = useState("")
  const [simulationMode, setSimulationMode] = useState(false)
  const [simulationCategory, setSimulationCategory] =
    useState<SimulationCategoryOption>("auto")
  const [simulationInfo, setSimulationInfo] = useState<{
    categoryLabel?: string
    description?: string
    originalSnippet?: string
    injectedSnippet?: string
    expectedDecision?: string
    experimentalResponse?: string
  } | null>(null)
  const [simulationEval, setSimulationEval] = useState<{
    detected?: boolean
    summary?: string
    actualDecision?: string
    expectedDecision?: string
    enginesThatDetected?: string[]
    detectionDetails?: Array<{ engine: string; stage: string; detail: string }>
    falseNegative?: boolean
    detectionLatencyMs?: number
  } | null>(null)

  const [provider, setProvider] = useState("")
  const [model, setModel] = useState("")
  const [providers, setProviders] = useState<{ id: string; name: string; models: { id: string; name: string }[] }[]>([])

  useEffect(() => {
    async function loadLLMConfig() {
      try {
        const [provRes, confRes] = await Promise.all([
          fetch("/api/llm/providers"),
          fetch("/api/llm/config")
        ])
        if (provRes.ok && confRes.ok) {
          const provData = await provRes.json()
          const confData = await confRes.json()
          setProviders(provData)
          setProvider(confData.defaultProvider || "")
          setModel(confData.defaultModel || "")
        }
      } catch (err) {}
    }
    loadLLMConfig()
  }, [])

  useEffect(() => {
    fetch("/api/docs")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setDocs(data))
      .catch(() => {})
  }, [])

  const severity = safety?.severity || "low"
  const severityColor =
    severity === "critical"
      ? "bg-red-600 text-white"
      : severity === "high"
        ? "bg-red-100 text-red-800"
        : severity === "medium"
          ? "bg-amber-100 text-amber-800"
          : "bg-green-100 text-green-800"

  const decisionStyle = useMemo(() => {
    if (decision === "pass") return "bg-green-500 text-white"
    if (decision === "rewrite") return "bg-amber-500 text-white"
    if (decision === "block" || decision === "prompt_injection" || decision === "conflict")
      return "bg-red-600 text-white"
    return "bg-slate-200 text-slate-600"
  }, [decision])

  const handleAsk = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setAsked(true)
    setError("")
    setStageIdx(0)
    setRawLlm("")
    setFinalResponse("")
    setGeneratorModel("")
    setCrossVerifier(null)
    setFirewallCore(null)
    setEvidence([])
    setEvidenceSummary("")
    setDecision(undefined)
    setSafety(undefined)
    setValidationStages([])
    setEngineReason("")
    setReason("")
    setLiveClaims([])
    setClaimIntelSummary("")
    setDecisionIntel(null)
    setDecisionDetailsOpen(false)
    setHandoffToReport(false)
    setAdaptiveHint("")
    setSimulationInfo(null)
    setSimulationEval(null)

    try {
      const selectedDoc = docs.find((d) => d.id === docId)
      const targetDomain = selectedDoc?.domain || "enterprise"
      
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          docId: docId || undefined,
          domain: targetDomain,
          simulationMode: simulationMode || undefined,
          simulationCategory: simulationMode ? simulationCategory : undefined,
          provider: provider || undefined,
          model: model || undefined,
        }),
      })
      if (!res.body) throw new Error("No stream")
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let lastSafety: SafetyPlatformReport | undefined
      let lastTrustOs: unknown
      let lastDecisionValidation: unknown
      let lastReasoning: unknown
      let lastDecisionIntel: unknown
      let lastInvestigationReport: unknown
      let lastFirewallCore: unknown
      let lastRaw = ""
      let lastFinal = ""
      let lastDecision = ""
      let lastReason = ""
      let lastDomain = ""
      let lastConf = 0
      let lastExplanation: unknown
      let lastStages: Array<{ label: string; verdict: string; detail: string }> = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n\n")
        buffer = parts.pop() || ""
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith("data: ")) continue
          const event = JSON.parse(line.slice(6)) as SSEEvent
          switch (event.stage) {
            case "received":
            case "domain_detection":
            case "prompt_security":
            case "llm_response":
            case "claim_extraction":
            case "evidence_matching":
            case "conflict_check":
            case "fact_check":
            case "confidence_score":
            case "ethics_check":
            case "reliability":
            case "decision":
            case "final_response": {
              const idx = liveStageIndexFromSse(event.stage)
              if (idx >= 0) setStageIdx(idx)
              break
            }
            default:
              break
          }
          switch (event.stage) {
            case "received":
              break
            case "llm_response":
              lastRaw = (event.data.text as string) || ""
              setRawLlm(lastRaw)
              if (typeof event.data.generatorModel === "string") {
                setGeneratorModel(event.data.generatorModel)
              }
              if (typeof event.data.experimentalText === "string") {
                setSimulationInfo((prev) => ({
                  ...prev,
                  experimentalResponse: event.data.experimentalText as string,
                }))
              }
              break
            case "claim_extraction": {
              if (typeof event.data.summary === "string") {
                setClaimIntelSummary(event.data.summary)
              }
              if (Array.isArray(event.data.claims)) {
                const incoming = event.data.claims as LiveClaim[]
                setLiveClaims((prev) => {
                  const map = new Map(prev.map((c) => [c.id, c]))
                  for (const c of incoming) {
                    map.set(c.id, { ...map.get(c.id), ...c })
                  }
                  return [...map.values()]
                })
              }
              break
            }
            case "evidence_matching":
              if (Array.isArray(event.data.retrievedEvidence)) {
                setEvidence(event.data.retrievedEvidence as typeof evidence)
              }
              if (typeof event.data.evidenceSummary === "string") {
                setEvidenceSummary(event.data.evidenceSummary)
              }
              if (event.data.reasoning) {
                lastReasoning = event.data.reasoning
              }
              setLiveClaims((prev) =>
                prev.map((c) =>
                  c.investigationStatus === "waiting_for_evidence" ||
                  c.investigationStatus === "under_verification"
                    ? {
                        ...c,
                        investigationStatus: "evidence_retrieved",
                        investigationStatusLabel: "Evidence Retrieved",
                      }
                    : c
                )
              )
              break
            case "conflict_check":
              break
            case "fact_check":
              if (Array.isArray(event.data.claims)) {
                setLiveClaims(event.data.claims as LiveClaim[])
              }
              break
            case "confidence_score":
              setConfidence(event.data.confidenceScore as number)
              lastConf = (event.data.confidenceScore as number) || 0
              break
            case "ethics_check":
              break
            case "reliability":
              if (
                event.data.adaptiveMemory &&
                typeof event.data.adaptiveMemory === "object"
              ) {
                const am = event.data.adaptiveMemory as {
                  summary?: string
                  matched?: boolean
                }
                if (am.summary) setAdaptiveHint(am.summary)
              }
              if (event.data.crossVerifier && typeof event.data.crossVerifier === "object") {
                const cv = event.data.crossVerifier as NonNullable<typeof crossVerifier>
                setCrossVerifier({
                  enabled: Boolean(cv.enabled),
                  model: cv.model || "",
                  suspectedIssues: Array.isArray(cv.suspectedIssues)
                    ? cv.suspectedIssues
                    : [],
                  suggestedFocus: Array.isArray(cv.suggestedFocus)
                    ? cv.suggestedFocus
                    : [],
                  agreementHint: cv.agreementHint || "uncertain",
                  note: cv.note || "",
                })
              }
              if (event.data.simulation && typeof event.data.simulation === "object") {
                const sim = event.data.simulation as {
                  categoryLabel?: string
                  description?: string
                  originalSnippet?: string
                  injectedSnippet?: string
                  expectedDecision?: string
                  experimentalResponse?: string
                }
                setSimulationInfo({
                  categoryLabel: sim.categoryLabel,
                  description: sim.description,
                  originalSnippet: sim.originalSnippet,
                  injectedSnippet: sim.injectedSnippet,
                  expectedDecision: sim.expectedDecision,
                  experimentalResponse: sim.experimentalResponse,
                })
              }
              break
            case "decision":
              lastDecision = event.data.decision as string
              lastReason = (event.data.reason as string) || ""
              setDecision(event.data.decision as Decision)
              setReason(lastReason)
              if (event.data.safety) {
                lastSafety = event.data.safety as SafetyPlatformReport
                setSafety(lastSafety)
                if (lastSafety.retrievedEvidence?.length) {
                  setEvidence(lastSafety.retrievedEvidence)
                }
                if (lastSafety.claims?.length) {
                  setLiveClaims(
                    lastSafety.claims.map((c) => ({
                      id: c.id,
                      claim: c.claim,
                      category: (c as LiveClaim).category,
                      investigationStatus: (c as LiveClaim).investigationStatus,
                      verdict: c.verdict,
                      supportStatus: (c as LiveClaim).supportStatus,
                      similarity: c.similarity,
                      retrievedDocument: c.retrievedDocument,
                    }))
                  )
                }
              }
              if (event.data.explanation) lastExplanation = event.data.explanation
              if (event.data.firewallDomain) lastDomain = event.data.firewallDomain as string
              break
            case "final_response":
              lastFinal = (event.data.text as string) || ""
              setFinalResponse(lastFinal)
              if (event.data.decision) {
                lastDecision = event.data.decision as string
                setDecision(event.data.decision as Decision)
              }
              if (typeof event.data.generatorModel === "string") {
                setGeneratorModel(event.data.generatorModel)
              }
              if (event.data.crossVerifier && typeof event.data.crossVerifier === "object") {
                const cv = event.data.crossVerifier as NonNullable<typeof crossVerifier>
                setCrossVerifier({
                  enabled: Boolean(cv.enabled),
                  model: cv.model || "",
                  suspectedIssues: Array.isArray(cv.suspectedIssues)
                    ? cv.suspectedIssues
                    : [],
                  suggestedFocus: Array.isArray(cv.suggestedFocus)
                    ? cv.suggestedFocus
                    : [],
                  agreementHint: cv.agreementHint || "uncertain",
                  note: cv.note || "",
                })
              }
              if (event.data.safety) {
                lastSafety = event.data.safety as SafetyPlatformReport
                setSafety(lastSafety)
                if (lastSafety.claims?.length) {
                  setLiveClaims(
                    lastSafety.claims.map((c) => ({
                      id: c.id,
                      claim: c.claim,
                      category: (c as LiveClaim).category,
                      investigationStatus: (c as LiveClaim).investigationStatus,
                      verdict: c.verdict,
                      supportStatus: (c as LiveClaim).supportStatus,
                      similarity: c.similarity,
                      retrievedDocument: c.retrievedDocument,
                      decomposedFromComposite: (c as LiveClaim).decomposedFromComposite,
                      numericalValues: (c as LiveClaim).numericalValues,
                      legalSections: (c as LiveClaim).legalSections,
                      medicalTerms: (c as LiveClaim).medicalTerms,
                    }))
                  )
                }
              }
              if (event.data.trustOs) lastTrustOs = event.data.trustOs
              if (event.data.decisionValidation) {
                lastDecisionValidation = event.data.decisionValidation
              }
              if (event.data.reasoningIntelligence) {
                lastReasoning = event.data.reasoningIntelligence
              }
              if (event.data.reasoning && !lastReasoning) {
                lastReasoning = event.data.reasoning
              }
              if (event.data.decisionIntelligence) {
                lastDecisionIntel = event.data.decisionIntelligence
                setDecisionIntel(
                  event.data.decisionIntelligence as NonNullable<typeof decisionIntel>
                )
              }
              if (event.data.investigationReport) {
                lastInvestigationReport = event.data.investigationReport
              }
              if (event.data.firewallCore) {
                lastFirewallCore = event.data.firewallCore
                setFirewallCore(
                  event.data.firewallCore as NonNullable<typeof firewallCore>
                )
              }
              if (Array.isArray(event.data.validationStages)) {
                lastStages = (
                  event.data.validationStages as Array<{
                    label: string
                    verdict: string
                    detail: string
                  }>
                ).map((s) => ({
                  label: s.label,
                  verdict: s.verdict,
                  detail: s.detail,
                }))
                setValidationStages(lastStages)
              }
              if (event.data.decisionEngineReason) {
                setEngineReason(event.data.decisionEngineReason as string)
                lastReason = (event.data.decisionEngineReason as string) || lastReason
                setReason(lastReason)
              }
              if (event.data.rawLlmResponse) {
                lastRaw = event.data.rawLlmResponse as string
                setRawLlm(lastRaw)
              }
              if (event.data.simulation && typeof event.data.simulation === "object") {
                const sim = event.data.simulation as NonNullable<typeof simulationInfo>
                setSimulationInfo((prev) => ({ ...prev, ...sim }))
              }
              if (
                event.data.simulationEvaluation &&
                typeof event.data.simulationEvaluation === "object"
              ) {
                setSimulationEval(
                  event.data.simulationEvaluation as NonNullable<typeof simulationEval>
                )
              }
              if (typeof event.data.experimentalResponse === "string") {
                setSimulationInfo((prev) => ({
                  ...prev,
                  experimentalResponse: event.data.experimentalResponse as string,
                }))
              }
              saveVerificationSession({
                decision: lastDecision,
                reason: lastReason,
                rawLlmResponse: lastRaw,
                finalResponse: lastFinal,
                firewallDomain: lastDomain,
                confidenceScore: lastConf,
                safety: lastSafety,
                explanation: lastExplanation,
                trustOs: lastTrustOs,
                courtroom: (lastTrustOs as any)?.courtroom,
                judgeDecision: (lastTrustOs as any)?.judgeDecision,
                decisionValidation: lastDecisionValidation,
                reasoningIntelligence: lastReasoning,
                decisionIntelligence: lastDecisionIntel,
                investigationReport: lastInvestigationReport,
                firewallCore: lastFirewallCore,
                query: query.trim(),
              })
              // Stay on console longer in simulation mode so evaluation is visible
              if (simulationMode) {
                setHandoffToReport(false)
              } else {
                // Give time to read mandatory Response Comparison before Investigation Report
                setHandoffToReport(true)
                setTimeout(() => router.push("/dashboard/explainability"), 5000)
              }
              break
            case "error":
              setError((event.data.error as string) || "Pipeline error")
              break
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Query failed")
    } finally {
      setLoading(false)
    }
  }, [query, docId, router, simulationMode, simulationCategory])

  const liveDetail =
    stageIdx >= 0 && stageIdx < LIVE_INVESTIGATION_STAGES.length
      ? LIVE_INVESTIGATION_STAGES[stageIdx].detail
      : ""

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Verification Console</h1>
        <p className="text-sm text-muted dark:text-slate-400 mt-1">
          Investigate AI responses against your knowledge base — this is a verification
          platform, not a chatbot.
        </p>
      </div>

      <InvestigationJourney current="verify" />

      {(() => {
        const selectedDoc = docs.find((d) => d.id === docId)
        const isNotReady = selectedDoc && selectedDoc.status && selectedDoc.status !== "READY" && selectedDoc.status !== "indexed"
        return (
          <div className="rounded-xl border border-border bg-white p-4 dark:bg-slate-900 dark:border-slate-700 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                className="rounded-lg border border-border px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600 max-w-xs"
                value={docId}
                onChange={(e) => setDocId(e.target.value)}
              >
                <option value="">All domain knowledge</option>
                {docs.filter((d) => d.isDataset).length > 0 && (
                  <optgroup label="Datasets">
                    {docs
                      .filter((d) => d.isDataset)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          📦 {d.datasetName || d.title} ({d.sourceFiles?.length || 1} files · {d.status || "READY"})
                        </option>
                      ))}
                  </optgroup>
                )}
                {docs.filter((d) => !d.isDataset).length > 0 && (
                  <optgroup label="Individual Documents">
                    {docs
                      .filter((d) => !d.isDataset)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          📄 {d.title} ({d.chunks} chunks)
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
              <input
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600"
                placeholder="Ask a question for the firewall to investigate across datasets…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && !isNotReady && handleAsk()}
              />
              <button
                type="button"
                disabled={loading || !query.trim() || Boolean(isNotReady)}
                onClick={handleAsk}
                className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-semibold disabled:opacity-50"
              >
                {loading ? "Investigating…" : "Investigate"}
              </button>
            </div>

            {isNotReady && (
              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                <span>
                  ⚠️ Selected dataset is currently <strong>{selectedDoc?.status}</strong>. Please wait for indexing to complete or visit the Knowledge Base to retry.
                </span>
                <Link
                  href="/dashboard/knowledge-base"
                  className="font-semibold underline ml-2 shrink-0"
                >
                  Knowledge Base →
                </Link>
              </div>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}
            {adaptiveHint && (
              <p className="text-xs text-accent">{adaptiveHint}</p>
            )}

            <div className="rounded-lg border border-dashed border-border px-3 py-3 dark:border-slate-600 space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-2">
                  <span>Provider:</span>
                  <select 
                    value={provider}
                    onChange={(e) => {
                      setProvider(e.target.value)
                      const prov = providers.find(p => p.id === e.target.value)
                      if (prov && prov.models.length > 0) setModel(prov.models[0].id)
                    }}
                    className="rounded border border-border px-2 py-1 dark:bg-slate-800 dark:border-slate-600 max-w-[140px]"
                  >
                    {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {providers.find(p => p.id === provider) && (
                  <div className="flex items-center gap-2">
                    <span>Model:</span>
                    <select 
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="rounded border border-border px-2 py-1 dark:bg-slate-800 dark:border-slate-600 max-w-[180px] truncate"
                    >
                      {providers.find(p => p.id === provider)?.models.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="border-t border-border dark:border-slate-700 pt-3">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulationMode}
                  onChange={(e) => setSimulationMode(e.target.checked)}
                  className="rounded border-border"
                />
                Simulation Mode (admin / research) — inject a controlled hallucination before verification
              </label>
              {simulationMode && (
                <div className="flex flex-wrap items-center gap-2 pl-5">
                  <select
                    className="rounded-lg border border-border px-2 py-1.5 text-xs dark:bg-slate-800 dark:border-slate-600"
                    value={simulationCategory}
                    onChange={(e) =>
                      setSimulationCategory(e.target.value as SimulationCategoryOption)
                    }
                  >
                    <option value="auto">Auto-select category</option>
                    <option value="unsupported_fact">Unsupported Fact</option>
                    <option value="contradicted_fact">Contradicted Fact</option>
                    <option value="unsupported_inference">Unsupported Inference</option>
                    <option value="numerical_hallucination">Numerical Hallucination</option>
                    <option value="temporal_hallucination">Temporal Hallucination</option>
                    <option value="policy_hallucination">Policy Hallucination</option>
                    <option value="fabricated_reference">Fabricated Reference</option>
                    <option value="context_hallucination">Context Hallucination</option>
                  </select>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    Knowledge base is never modified. Only an experimental response copy is tested.
                  </p>
                </div>
              )}
              </div>
            </div>
          </div>
        )
      })()}

      {simulationMode && (simulationInfo || simulationEval) && (
        <div
          className={`rounded-xl border p-4 space-y-2 ${
            simulationEval?.detected
              ? "border-green-300 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800"
              : simulationEval?.falseNegative
                ? "border-red-300 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800"
                : "border-amber-300 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-800"
          }`}
        >
          <p className="text-xs font-mono uppercase tracking-widest text-muted">
            Firewall evaluation · controlled simulation
          </p>
          {simulationInfo && (
            <>
              <p className="text-sm font-semibold">
                Injected: {simulationInfo.categoryLabel || "Hallucination"}
              </p>
              <p className="text-xs text-muted">{simulationInfo.description}</p>
              <p className="text-xs">
                <span className="text-muted">Change:</span>{" "}
                <span className="line-through opacity-70">
                  {simulationInfo.originalSnippet}
                </span>{" "}
                → <span className="font-medium">{simulationInfo.injectedSnippet}</span>
              </p>
              <p className="text-xs text-muted">
                Expected verdict: {(simulationInfo.expectedDecision || "rewrite").toUpperCase()}
              </p>
            </>
          )}
          {simulationEval && (
            <div className="pt-2 border-t border-black/5 dark:border-white/10 space-y-1">
              <p
                className={`text-sm font-semibold ${
                  simulationEval.detected ? "text-safe" : "text-danger"
                }`}
              >
                {simulationEval.detected
                  ? "Firewall DETECTED the injected hallucination"
                  : "Firewall MISSED the injected hallucination"}
              </p>
              <p className="text-xs">{simulationEval.summary}</p>
              <p className="text-xs text-muted">
                Actual: {(simulationEval.actualDecision || "—").toUpperCase()} · Engines:{" "}
                {(simulationEval.enginesThatDetected || []).join(", ") || "—"} ·{" "}
                {simulationEval.detectionLatencyMs != null
                  ? `${simulationEval.detectionLatencyMs}ms`
                  : ""}
              </p>
              {(simulationEval.detectionDetails || []).slice(0, 4).map((d, i) => (
                <p key={i} className="text-[11px] text-muted">
                  · {d.engine} / {d.stage}: {d.detail}
                </p>
              ))}
              <Link
                href="/dashboard/explainability"
                className="inline-block text-xs text-accent font-semibold mt-1"
              >
                Open Investigation Report →
              </Link>
            </div>
          )}
        </div>
      )}

      {handoffToReport && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-accent font-medium">
            Investigation complete — review Response Comparison below, then the Investigation
            Report opens…
          </p>
          <Link
            href="/dashboard/explainability"
            className="text-xs font-semibold text-accent underline"
          >
            Open report now →
          </Link>
        </div>
      )}

      {asked && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-white p-4 dark:bg-slate-900 dark:border-slate-700 max-h-[420px] overflow-auto">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <p className="text-xs font-mono uppercase tracking-widest text-muted">
                  Retrieved Evidence
                </p>
                {evidenceSummary && (
                  <p className="text-[10px] text-muted max-w-[60%] text-right">{evidenceSummary}</p>
                )}
              </div>
              {evidence.length === 0 ? (
                <p className="text-sm text-muted">Waiting for evidence investigation…</p>
              ) : (
                <div className="space-y-3">
                  {evidence.map((ev, i) => {
                    const rel = ev.relation || "supports"
                    const relStyle =
                      rel === "supports"
                        ? "border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800"
                        : rel === "partially_supports"
                          ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800"
                          : rel === "contradicts"
                            ? "border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800"
                            : rel === "rejected" || rel === "absent"
                              ? "border-slate-200 bg-slate-50 dark:bg-slate-800/40 dark:border-slate-700"
                              : "border-border dark:border-slate-700"
                    return (
                      <div key={i} className={`rounded-lg border p-3 ${relStyle}`}>
                        <div className="flex justify-between gap-2 text-[11px] text-muted mb-1">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {ev.sourceFile || ev.documentName}
                          </span>
                          <span className="uppercase font-mono tracking-wide shrink-0">
                            {rel.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted mb-1 flex flex-wrap gap-x-2 gap-y-0.5">
                          {ev.sheet && (
                            <span className="font-medium text-accent">Sheet: {ev.sheet}</span>
                          )}
                          {ev.row != null && (
                            <span className="font-medium text-accent">Row: {ev.row}</span>
                          )}
                          {!ev.sheet && ev.row == null && (
                            <span>Page {ev.page ?? "—"}</span>
                          )}
                          {ev.section && !ev.sheet ? <span>· {ev.section}</span> : null}
                          {ev.authorityLevel ? <span>· {ev.authorityLevel} authority</span> : null}
                          {ev.similarity > 0 ? (
                            <span>· relevance {Math.round(ev.similarity * 100)}%</span>
                          ) : null}
                          {ev.sufficientForClaim ? <span className="text-safe font-semibold">· sufficient</span> : null}
                        </p>
                        {ev.columns && ev.columns.length > 0 && (
                          <p className="text-[10px] text-muted mb-1">
                            Columns: {ev.columns.slice(0, 5).join(", ")}{ev.columns.length > 5 ? ` (+${ev.columns.length - 5} more)` : ""}
                          </p>
                        )}
                        {ev.claimSnippet && (
                          <p className="text-[10px] text-muted mb-1 italic">
                            Re: {ev.claimSnippet}
                            {ev.claimSnippet.length >= 100 ? "…" : ""}
                          </p>
                        )}
                        <p className="text-sm text-slate-700 dark:text-slate-300">{ev.paragraph}</p>
                        {ev.reason && (
                          <p className="text-[10px] text-muted mt-1.5 border-t border-black/5 dark:border-white/10 pt-1.5">
                            {ev.reason}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 dark:bg-amber-950/20 dark:border-amber-800 max-h-[420px] overflow-auto">
              <p className="text-xs font-mono uppercase tracking-widest text-amber-800 dark:text-amber-300 mb-3">
                Original AI Response
              </p>
              <p className="text-[10px] text-amber-700 dark:text-amber-400 mb-2">
                Untrusted OpenRouter Generator output — preserved exactly; never edited by the
                firewall
                {simulationMode ? " (experimental copy is verified separately)" : ""}
              </p>
              <p className="text-sm whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                {rawLlm || (loading ? "Generating…" : "—")}
              </p>
              {generatorModel && (
                <p className="text-[10px] text-muted mt-2">Model: {generatorModel}</p>
              )}
              {simulationInfo?.experimentalResponse && (
                <div className="mt-3 pt-3 border-t border-amber-200/80 dark:border-amber-800">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300 mb-1">
                    Experimental copy (under investigation)
                  </p>
                  <p className="text-sm whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                    {simulationInfo.experimentalResponse}
                  </p>
                </div>
              )}
            </div>
          </div>

          {(liveClaims.length > 0 || loading) && (
            <div className="rounded-xl border border-border bg-white p-4 dark:bg-slate-900 dark:border-slate-700">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <p className="text-xs font-mono uppercase tracking-widest text-muted">
                  Claim Investigation
                </p>
                {claimIntelSummary && (
                  <p className="text-[11px] text-muted">{claimIntelSummary}</p>
                )}
              </div>
              {liveClaims.length === 0 ? (
                <p className="text-sm text-muted">Extracting factual claims…</p>
              ) : (
                <div className="space-y-2">
                  {liveClaims.map((c) => (
                    <div
                      key={c.id}
                      className={`rounded-lg border px-3 py-2.5 text-xs ${claimStatusStyle(c.investigationStatus)}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <span className="font-mono text-[10px] uppercase tracking-wide opacity-80">
                          {c.id} · {categoryLabel(c.category)}
                          {c.decomposedFromComposite ? " · decomposed" : ""}
                        </span>
                        <span className="font-semibold uppercase tracking-wide text-[10px]">
                          {c.investigationStatusLabel ||
                            c.investigationStatus?.replace(/_/g, " ") ||
                            "Waiting"}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-snug">{c.claim}</p>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] opacity-80">
                        {c.similarity != null && c.similarity > 0 && (
                          <span>evidence fit {Math.round(c.similarity * 100)}%</span>
                        )}
                        {c.retrievedDocument && <span>{c.retrievedDocument}</span>}
                        {c.numericalValues?.length ? (
                          <span>nums: {c.numericalValues.slice(0, 3).join(", ")}</span>
                        ) : null}
                        {c.legalSections?.length ? (
                          <span>{c.legalSections.slice(0, 2).join(", ")}</span>
                        ) : null}
                        {c.medicalTerms?.length ? (
                          <span>{c.medicalTerms.slice(0, 2).join(", ")}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-border bg-white p-4 dark:bg-slate-900 dark:border-slate-700">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
              <p className="text-xs font-mono uppercase tracking-widest text-muted">
                Live investigation
              </p>
              {loading && liveDetail && (
                <p className="text-[11px] text-accent font-medium max-w-[70%] text-right">
                  {liveDetail}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {PIPELINE.map((label, i) => {
                const active = stageIdx === i
                const done = stageIdx > i
                return (
                  <motion.div
                    key={label}
                    animate={active ? { scale: [1, 1.04, 1] } : {}}
                    transition={{ repeat: active ? Infinity : 0, duration: 1.2 }}
                    className={`px-3 py-2 rounded-lg text-[11px] font-medium border ${
                      done
                        ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300"
                        : active
                          ? "bg-accent/10 border-accent text-accent"
                          : "border-border text-muted dark:border-slate-700"
                    }`}
                  >
                    {label}
                  </motion.div>
                )
              })}
            </div>
            {validationStages.length > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {validationStages.map((s) => (
                  <div
                    key={s.label}
                    className={`rounded-lg border px-2.5 py-2 text-[11px] ${
                      s.verdict === "pass"
                        ? "border-green-200 bg-green-50 dark:bg-green-950/30"
                        : s.verdict === "warn"
                          ? "border-amber-200 bg-amber-50 dark:bg-amber-950/30"
                          : "border-red-200 bg-red-50 dark:bg-red-950/30"
                    }`}
                  >
                    <div className="flex justify-between gap-2 font-semibold">
                      <span>{s.label}</span>
                      <span className="uppercase font-mono">{s.verdict}</span>
                    </div>
                    <p className="mt-1 opacity-80">{s.detail}</p>
                  </div>
                ))}
              </div>
            )}
            {engineReason && (
              <p className="mt-3 text-xs text-muted border-t border-border pt-3 dark:border-slate-700">
                {engineReason}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-white p-4 dark:bg-slate-900 dark:border-slate-700 md:col-span-1">
              <p className="text-xs text-muted mb-2">Decision Intelligence</p>
              <div className={`inline-flex px-4 py-2 rounded-lg font-bold text-sm ${decisionStyle}`}>
                {firewallCore?.decision?.trustVerdictLabel ||
                  (decision === "pass"
                    ? "VERIFIED"
                    : decision === "rewrite"
                      ? "PARTIALLY VERIFIED"
                      : decision === "block"
                        ? "UNVERIFIED / UNSAFE"
                        : (decision || "—").toUpperCase())}
              </div>
              <p className="text-[10px] font-mono uppercase mt-1 text-muted">
                Action:{" "}
                {firewallCore?.decision?.actionLabel ||
                  (decision === "pass"
                    ? "PASS"
                    : decision === "rewrite"
                      ? "REWRITE"
                      : decision
                        ? "BLOCK"
                        : "—")}
              </p>
              {decisionIntel?.severity && decisionIntel.severity !== "none" && (
                <p className="text-[10px] uppercase font-mono mt-2 text-muted">
                  Failure severity: {decisionIntel.severity}
                </p>
              )}
              <p className="text-xs text-muted mt-3">{reason || decisionIntel?.reason}</p>
              <button
                type="button"
                className="mt-3 text-xs text-accent underline"
                onClick={() => setDecisionDetailsOpen((o) => !o)}
              >
                {decisionDetailsOpen ? "Hide investigation summary" : "Expand decision details"}
              </button>
              <button
                type="button"
                className="mt-2 ml-3 text-xs text-accent underline"
                onClick={() => setInspectorOpen(true)}
              >
                Explain Decision
              </button>
            </div>
            <div className="rounded-xl border border-border bg-white p-4 dark:bg-slate-900 dark:border-slate-700">
              <p className="text-xs text-muted mb-2">Hallucination Severity</p>
              <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${severityColor}`}>
                {severity}
              </span>
              <p className="text-xs text-muted mt-3">
                Confidence {confidence != null ? `${Math.round(confidence * 100)}%` : "—"}
                <span className="block text-[10px] mt-1 opacity-70">
                  Supporting context only — not the decision criterion
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-border bg-white p-4 dark:bg-slate-900 dark:border-slate-700 space-y-1 text-xs">
              <p className="text-muted mb-2">Evidence Strength Meter</p>
              <p>
                Strength{" "}
                <strong>{safety?.evidenceStrength.evidenceStrengthPercent ?? "—"}%</strong>
              </p>
              <p>Supporting docs: {safety?.evidenceStrength.supportingDocuments ?? "—"}</p>
              <p>Contradictions: {safety?.evidenceStrength.contradictions ?? "—"}</p>
              <p>
                Coverage{" "}
                {safety
                  ? `${Math.round(safety.evidenceStrength.evidenceCoverage * 100)}%`
                  : "—"}
              </p>
              <p className="pt-2 border-t border-border dark:border-slate-700">
                Trust {safety ? Math.round(safety.extendedTrust.finalTrustScore * 100) : "—"}% ·
                Governance {safety?.governance.governancePercent ?? "—"}%
              </p>
              <p>
                Ethics:{" "}
                <span className="font-semibold uppercase">{safety?.ethics.level || "—"}</span>
              </p>
            </div>
          </div>

          {decision && !loading && (
            <ResponseComparison
              query={query.trim()}
              originalResponse={rawLlm}
              finalResponse={finalResponse}
              decision={decision}
              trustVerdictLabel={firewallCore?.decision?.trustVerdictLabel}
              actionLabel={firewallCore?.decision?.actionLabel}
              reason={reason || firewallCore?.decision?.reason || engineReason}
              evidence={evidence}
              claims={liveClaims}
              inferences={firewallCore?.inferences}
              policyCompliant={firewallCore?.policy?.compliant}
              policyTriggers={firewallCore?.policy?.triggers}
              ethicsLevel={firewallCore?.policy?.ethicsLevel || safety?.ethics.level}
              medicalUnsafe={firewallCore?.policy?.medicalUnsafe}
              correctionsApplied={
                decisionIntel?.justification?.correctionsApplied ||
                firewallCore?.recovery?.detail
              }
              rootCauses={
                firewallCore?.investigation?.rootCauses ||
                decisionIntel?.justification?.rootCauses
              }
              crossVerifier={crossVerifier}
              generatorModel={generatorModel}
            />
          )}

          {decisionDetailsOpen && decisionIntel && (
            <div className="rounded-xl border border-border bg-white p-4 dark:bg-slate-900 dark:border-slate-700 space-y-4">
              <p className="text-xs font-mono uppercase tracking-widest text-muted">
                Decision Investigation Summary
              </p>
              <p className="text-xs text-muted">{decisionIntel.justification?.confidenceNote}</p>
              {decisionIntel.checklist && decisionIntel.checklist.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold">Verification checklist</p>
                  {decisionIntel.checklist.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-lg border px-3 py-2 text-[11px] ${
                        item.answer === "yes" &&
                        ["claims_verified", "evidence_sufficient", "temporal_current", "correctable"].includes(
                          item.id
                        )
                          ? "border-green-200 bg-green-50/50 dark:bg-green-950/20"
                          : item.answer === "no" &&
                              [
                                "no_contradictions",
                                "reasoning_valid",
                                "numerical_ok",
                                "policy_ok",
                                "safety_ok",
                              ].includes(item.id)
                            ? "border-green-200 bg-green-50/50 dark:bg-green-950/20"
                            : item.answer === "partial"
                              ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20"
                              : "border-red-200 bg-red-50/50 dark:bg-red-950/20"
                      }`}
                    >
                      <div className="flex justify-between gap-2 font-semibold">
                        <span>{item.question}</span>
                        <span className="uppercase font-mono shrink-0">{item.answer}</span>
                      </div>
                      <p className="mt-1 opacity-80">{item.detail}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-300 mb-1">
                    Claims passed
                  </p>
                  {(decisionIntel.justification?.claimsPassed || []).length ? (
                    decisionIntel.justification!.claimsPassed!.map((c, i) => (
                      <p key={i} className="text-muted">
                        • {c}
                      </p>
                    ))
                  ) : (
                    <p className="text-muted">None</p>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-red-800 dark:text-red-300 mb-1">
                    Claims failed
                  </p>
                  {(decisionIntel.justification?.claimsFailed || []).length ? (
                    decisionIntel.justification!.claimsFailed!.map((c, i) => (
                      <p key={i} className="text-muted">
                        • {c}
                      </p>
                    ))
                  ) : (
                    <p className="text-muted">None</p>
                  )}
                </div>
              </div>
              <div className="text-[11px] space-y-1 border-t border-border pt-3 dark:border-slate-700">
                <p>
                  <span className="font-semibold">Primary cause:</span>{" "}
                  {(decisionIntel.justification?.primaryCause || "none").replace(/_/g, " ")}
                </p>
                <p>
                  <span className="font-semibold">Corrections:</span>{" "}
                  {decisionIntel.justification?.correctionsApplied || "—"}
                </p>
                <p>
                  <span className="font-semibold">Rules fired:</span>{" "}
                  {(decisionIntel.rulesFired || []).join(", ") || "—"}
                </p>
                {(decisionIntel.justification?.rootCauses || []).length > 0 && (
                  <p>
                    <span className="font-semibold">Root causes:</span>{" "}
                    {decisionIntel.justification!.rootCauses!.join(", ")}
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {inspectorOpen && safety && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] overflow-auto rounded-xl bg-white dark:bg-slate-900 border border-border dark:border-slate-700 p-4 space-y-3">
            <div className="flex justify-between items-center">
              <p className="font-semibold">Hallucination Inspector</p>
              <button type="button" onClick={() => setInspectorOpen(false)} className="text-sm">
                Close
              </button>
            </div>
            <p className="text-xs text-muted whitespace-pre-wrap">{rawLlm}</p>
            <div className="space-y-2">
              {(liveClaims.length ? liveClaims : safety.claims).map((c) => (
                <div key={c.id} className="rounded border border-border p-2 text-xs dark:border-slate-700">
                  <p className="font-medium">{c.claim}</p>
                  <p className="text-muted mt-1">
                    {c.verdict ? `${c.verdict} · ` : ""}
                    {c.similarity != null ? `sim ${Math.round(c.similarity * 100)}% · ` : ""}
                    {c.retrievedDocument || "no doc"}
                    {c.category ? ` · ${categoryLabel(c.category)}` : ""}
                  </p>
                </div>
              ))}
            </div>
            <ul className="text-xs space-y-1">
              {safety.reasonBullets.map((b, i) => (
                <li key={i}>• {b}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
