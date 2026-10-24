"use client"

import type { Decision, PipelineStage } from "@/types"

interface Props {
  stages: PipelineStage[]
  decision?: Decision
}

const STAGE_COLOR: Record<PipelineStage["status"], string> = {
  idle: "bg-slate-100 text-slate-500 border-slate-200",
  active: "bg-blue-50 text-blue-700 border-blue-200",
  complete: "bg-green-50 text-green-700 border-green-200",
  error: "bg-red-50 text-red-700 border-red-200",
}

export default function FirewallPipeline({ stages, decision }: Props) {
  return (
    <div className="space-y-3">
      {stages.map((stage, idx) => (
        <div
          key={stage.id}
          className={`rounded-lg border px-3 py-2 text-sm ${STAGE_COLOR[stage.status]}`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {idx + 1}. {stage.label}
            </span>
            <span className="text-xs uppercase">{stage.status}</span>
          </div>
        </div>
      ))}
      {decision && (
        <div className="rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm">
          Final decision: <span className="font-semibold uppercase">{decision}</span>
        </div>
      )}
    </div>
  )
}
