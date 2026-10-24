"use client"

import type { AuditEntry, SpanResult } from "@/types"

interface Props {
  auditEntries: AuditEntry[]
  flaggedSpans: SpanResult[]
  confidenceScore?: number
  factScore?: number
}

export default function AnalyticsCharts({ auditEntries, flaggedSpans, confidenceScore, factScore }: Props) {
  const blocked = auditEntries.filter((e) => e.decision === "block").length
  const rewritten = auditEntries.filter((e) => e.decision === "rewrite").length
  const passed = auditEntries.filter((e) => e.decision === "pass").length
  const hallucinated = flaggedSpans.filter((s) => s.status === "hallucinated").length

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
      <Card label="Passed" value={String(passed)} />
      <Card label="Rewritten" value={String(rewritten)} />
      <Card label="Blocked" value={String(blocked)} />
      <Card label="Fact score" value={factScore != null ? factScore.toFixed(2) : "--"} />
      <Card
        label="Confidence"
        value={confidenceScore != null ? `${Math.round(confidenceScore * 100)}%` : "--"}
        sub={`${hallucinated} hallucinated spans`}
      />
    </div>
  )
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}
