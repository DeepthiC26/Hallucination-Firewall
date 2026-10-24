"use client"

import type {
  ConfidenceHeatmap,
  ConflictDetail,
  Decision,
  DecisionExplanation,
  DomainVerification,
  FirewallDomain,
  ReliabilityReport,
  SpanResult,
} from "@/types"

const FAILURE_LABELS: Record<string, string> = {
  missing_evidence: "Missing Evidence",
  conflicting_documents: "Conflicting Documents",
  outdated_policy: "Outdated Policy",
  low_similarity: "Low Similarity",
  unsupported_claim: "Unsupported Claim",
  prompt_injection: "Prompt Injection",
  none: "None",
}

interface Props {
  llmResponse?: string
  finalResponse?: string
  flaggedSpans: SpanResult[]
  confidenceScore?: number
  decision?: Decision
  sourcesUsed: string[]
  reason?: string
  isLoading: boolean
  explanation?: DecisionExplanation
  heatmap?: ConfidenceHeatmap
  conflicts?: ConflictDetail[]
  firewallDomain?: FirewallDomain
  domainVerification?: DomainVerification
  reliability?: ReliabilityReport
}

function spanColor(status: SpanResult["status"]) {
  if (status === "safe") return "bg-green-50 border-green-200"
  if (status === "uncertain") return "bg-amber-50 border-amber-200"
  return "bg-red-50 border-red-200"
}

function bandClasses(band: "green" | "yellow" | "red") {
  if (band === "green") return "bg-green-50 border-green-200 text-green-800"
  if (band === "yellow") return "bg-amber-50 border-amber-200 text-amber-800"
  return "bg-red-50 border-red-200 text-red-800"
}

function barColor(band: "green" | "yellow" | "red") {
  if (band === "green") return "bg-green-500"
  if (band === "yellow") return "bg-amber-500"
  return "bg-red-500"
}

function iconFor(icon: "check" | "warn" | "cross") {
  if (icon === "check") return "✓"
  if (icon === "warn") return "⚠"
  return "✗"
}

export default function ResponsePanel({
  llmResponse,
  finalResponse,
  flaggedSpans,
  confidenceScore,
  decision,
  sourcesUsed,
  reason,
  isLoading,
  explanation,
  heatmap,
  conflicts,
  firewallDomain,
  domainVerification,
  reliability,
}: Props) {
  const overallPct =
    heatmap?.overallConfidencePercent ??
    (confidenceScore != null ? Math.round(confidenceScore * 100) : null)

  const domainLabel = firewallDomain || domainVerification?.firewallDomain
  const trustPct =
    reliability?.trust.trustScore != null
      ? Math.round(reliability.trust.trustScore * 100)
      : null

  return (
    <div className="space-y-4 text-sm">
      {/* Confidence + Trust */}
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-xs text-slate-500">Overall Confidence</p>
          {domainLabel && (
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border border-border bg-slate-50 text-slate-600">
              {domainLabel}
            </span>
          )}
        </div>
        <div className="flex items-end gap-4">
          <p className="text-2xl font-bold">
            {overallPct != null ? `${overallPct}%` : "--"}
          </p>
          {trustPct != null && (
            <div className="pb-0.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Trust</p>
              <p className="text-lg font-semibold text-slate-800">{trustPct}%</p>
            </div>
          )}
        </div>
        {overallPct != null && (
          <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                overallPct >= 90
                  ? "bg-green-500"
                  : overallPct >= 60
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${overallPct}%` }}
            />
          </div>
        )}
        <p className="text-xs text-slate-500 mt-2">
          Decision:{" "}
          <span className="font-semibold uppercase">
            {decision || (isLoading ? "processing" : "--")}
          </span>
        </p>
        {reason && <p className="mt-2 text-xs text-slate-600">{reason}</p>}
        {reliability?.failureClass && reliability.failureClass !== "none" && (
          <p className="mt-2 text-xs font-semibold text-red-700">
            Failure: {FAILURE_LABELS[reliability.failureClass] || reliability.failureClass}
            {reliability.failureReason ? ` — ${reliability.failureReason}` : ""}
          </p>
        )}
      </div>

      {/* Reliability & Performance */}
      {reliability && (
        <div className="rounded-lg border border-border p-3 space-y-3">
          <p className="text-xs font-semibold text-slate-700">Reliability Layer</p>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
            <span>
              Consistency{" "}
              {reliability.consistency
                ? `${Math.round(reliability.consistency.consistencyScore * 100)}%`
                : "—"}
            </span>
            <span>
              Pred. risk{" "}
              {Math.round(reliability.riskPrediction.probability * 100)}%
            </span>
            <span>
              Freshness {Math.round(reliability.freshness.freshnessScore * 100)}%
            </span>
            <span>
              Evidence{" "}
              {Math.round(reliability.trust.evidenceQuality * 100)}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-slate-500 border-t border-border pt-2">
            <span>Retrieval {reliability.latency.retrievalMs}ms</span>
            <span>LLM {reliability.latency.llmMs}ms</span>
            <span>Verify {reliability.latency.verificationMs}ms</span>
            <span>Rewrite {reliability.latency.rewriteMs}ms</span>
            <span>Consistency {reliability.latency.consistencyMs}ms</span>
            <span>Total {reliability.latency.totalMs}ms</span>
          </div>
          {!!reliability.evidenceSnippets?.length && (
            <div className="space-y-2 border-t border-border pt-2">
              <p className="text-[11px] font-semibold text-slate-600">
                Supporting evidence
              </p>
              {reliability.evidenceSnippets.map((ev, i) => (
                <div key={i} className="rounded border border-border bg-slate-50 p-2">
                  <div className="flex justify-between gap-2 text-[10px] text-slate-500 mb-1">
                    <span className="font-semibold text-slate-700">{ev.document}</span>
                    <span>sim {Math.round(ev.similarity * 100)}%</span>
                  </div>
                  <p className="text-xs text-slate-700">{ev.snippet}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Phase 2 — Domain verification evidence */}
      {domainVerification && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-700">
            {domainVerification.firewallDomain === "legal"
              ? "Legal Evidence"
              : domainVerification.firewallDomain === "healthcare"
                ? "Medical Evidence"
                : "Domain Verification"}
          </p>
          {domainVerification.firewallDomain === "legal" && (
            <dl className="grid grid-cols-1 gap-1.5 text-xs text-slate-700">
              <div>
                <dt className="text-slate-500">Supporting Act</dt>
                <dd>{domainVerification.acts?.join("; ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Section Number</dt>
                <dd>{domainVerification.sections?.join("; ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Clause</dt>
                <dd>{domainVerification.clauses?.join("; ") || "—"}</dd>
              </div>
              {!!domainVerification.citations?.length && (
                <div>
                  <dt className="text-slate-500">Citations</dt>
                  <dd>{domainVerification.citations.join("; ")}</dd>
                </div>
              )}
            </dl>
          )}
          {domainVerification.firewallDomain === "healthcare" && (
            <dl className="grid grid-cols-1 gap-1.5 text-xs text-slate-700">
              <div>
                <dt className="text-slate-500">Guideline Name</dt>
                <dd>{domainVerification.guidelines?.join("; ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Medical Entities</dt>
                <dd>{domainVerification.medicalEntities?.join("; ") || "—"}</dd>
              </div>
              {domainVerification.unsafe && (
                <p className="text-xs font-semibold text-red-700">
                  Unsafe / ungrounded clinical claim — blocked
                </p>
              )}
            </dl>
          )}
          {!!domainVerification.details?.length && (
            <ul className="space-y-1 border-t border-border pt-2">
              {domainVerification.details.slice(0, 6).map((d, i) => (
                <li key={i} className="text-[11px] text-slate-600">
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* FEATURE 2 — Explainable AI */}
      {explanation && (
        <div
          className={`rounded-lg border p-3 ${
            explanation.decision === "pass"
              ? "bg-green-50/60 border-green-200"
              : explanation.decision === "rewrite"
                ? "bg-amber-50/60 border-amber-200"
                : "bg-red-50/60 border-red-200"
          }`}
        >
          <p className="text-xs font-semibold text-slate-700 mb-2">
            {explanation.title}
          </p>
          <ul className="space-y-1.5">
            {explanation.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                <span className="font-bold shrink-0 mt-0.5">{iconFor(b.icon)}</span>
                <span>{b.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* FEATURE 4 — Conflicting evidence */}
      {conflicts && conflicts.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-3">
          <div>
            <p className="text-sm font-semibold text-red-800">
              Conflicting Evidence Detected
            </p>
            <p className="text-xs text-red-700 mt-1">
              The uploaded enterprise documents contain conflicting information.
              Please review the source documents.
            </p>
          </div>
          {conflicts.map((c, i) => (
            <div key={i} className="rounded-md border border-red-200 bg-white p-2 space-y-2">
              <p className="text-[11px] font-mono text-red-700">
                {c.kind}: «{c.rawA}» vs «{c.rawB}»
              </p>
              <div className="grid grid-cols-1 gap-2">
                <div className="rounded border border-amber-200 bg-amber-50 p-2">
                  <p className="text-[10px] font-semibold text-amber-800 mb-1">
                    {c.documentA}
                  </p>
                  <p className="text-xs text-slate-700">
                    {highlightConflict(c.textA, c.rawA)}
                  </p>
                </div>
                <div className="rounded border border-rose-200 bg-rose-50 p-2">
                  <p className="text-[10px] font-semibold text-rose-800 mb-1">
                    {c.documentB}
                  </p>
                  <p className="text-xs text-slate-700">
                    {highlightConflict(c.textB, c.rawB)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border p-3">
        <p className="text-xs text-slate-500 mb-1">Original LLM response</p>
        <p className="whitespace-pre-wrap text-slate-700">
          {llmResponse || (isLoading ? "Waiting for response..." : "No response yet.")}
        </p>
      </div>

      <div className="rounded-lg border border-border p-3">
        <p className="text-xs text-slate-500 mb-1">Final response</p>
        <p className="whitespace-pre-wrap text-slate-900">
          {finalResponse || "No final response yet."}
        </p>
      </div>

      {/* FEATURE 3 — Confidence heatmap */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Confidence Heatmap</p>
          {overallPct != null && (
            <span className="text-[10px] font-mono text-slate-500">
              Overall {overallPct}%
            </span>
          )}
        </div>
        {!heatmap?.sentences?.length && flaggedSpans.length === 0 ? (
          <p className="text-xs text-slate-500">No sentence-level results yet.</p>
        ) : heatmap?.sentences?.length ? (
          heatmap.sentences.map((row) => (
            <div
              key={`hm-${row.index}`}
              className={`rounded-md border p-2 ${bandClasses(row.band)}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-[11px] font-semibold">
                  Sentence {row.index} · {row.confidencePercent}% {row.statusEmoji}{" "}
                  {row.statusLabel}
                </p>
              </div>
              <div className="h-1.5 rounded-full bg-white/70 overflow-hidden mb-2">
                <div
                  className={`h-full ${barColor(row.band)}`}
                  style={{ width: `${row.confidencePercent}%` }}
                />
              </div>
              <p className="text-sm text-slate-800">{row.sentence}</p>
              {row.matchedSource && (
                <p className="mt-1 text-[11px] text-slate-600">
                  Source: {row.matchedSource}
                </p>
              )}
            </div>
          ))
        ) : (
          flaggedSpans.map((span, idx) => (
            <div
              key={`${idx}-${span.sentence.slice(0, 20)}`}
              className={`rounded-md border p-2 ${spanColor(span.status)}`}
            >
              <p className="text-xs font-semibold uppercase mb-1">
                {span.status} · {span.score}
              </p>
              <p className="text-sm">{span.sentence}</p>
              {span.matchedSource && (
                <p className="mt-1 text-xs text-slate-600">
                  Source: {span.matchedSource}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      <div>
        <p className="text-xs text-slate-500 mb-1">Sources used</p>
        <p className="text-xs text-slate-700">
          {sourcesUsed.length ? sourcesUsed.join(", ") : "No sources cited."}
        </p>
      </div>
    </div>
  )
}

function highlightConflict(text: string, raw: string) {
  if (!raw || !text.toLowerCase().includes(raw.toLowerCase())) {
    return text
  }
  const idx = text.toLowerCase().indexOf(raw.toLowerCase())
  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + raw.length)
  const after = text.slice(idx + raw.length)
  return (
    <>
      {before}
      <mark className="bg-yellow-200 px-0.5 rounded font-semibold">{match}</mark>
      {after}
    </>
  )
}
