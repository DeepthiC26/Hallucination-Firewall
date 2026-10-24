"use client"

import { useState } from "react"
import type { FirewallDomain } from "@/types"

export interface ComparisonData {
  queryId?: string
  query: string
  domain: FirewallDomain
  rawLlmResponse: string
  finalResponse: string
  decision: string
  confidenceScore: number | null
  firewallEnabled?: boolean
  claims?: Array<{ claim: string; verdict?: string; supportStatus?: string }>
  evidenceSnippets?: string[]
  reason?: string
}

interface Props {
  data: ComparisonData | null
  onVerifyWithFirewall?: (rawResponse: string, query: string, domain: FirewallDomain) => void
}

export default function LiveComparisonPanel({ data, onVerifyWithFirewall }: Props) {
  const [verifying, setVerifying] = useState(false)

  if (!data) {
    return (
      <div className="rounded-2xl border border-border dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center space-y-2">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Live Firewall Middleware Comparison
        </p>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Send a query to observe how the Hallucination Firewall intercepts, verifies, and transforms the raw AI output in real time.
        </p>
      </div>
    )
  }

  const queryId = data.queryId || "HF-2026-1042"

  return (
    <div className="rounded-2xl border border-border dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm space-y-0">
      {/* Header Bar */}
      <div className="border-b border-border dark:border-slate-700 px-5 py-3.5 flex items-center justify-between flex-wrap gap-2 bg-slate-50/60 dark:bg-slate-800/50">
        <div className="flex items-center gap-2.5">
          <span className="text-base">⚡</span>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Middleware Architecture Comparison
            </p>
            <p className="text-[11px] text-slate-500 font-mono">
              Query ID: <strong className="text-foreground">{queryId}</strong> · Single Raw LLM Generation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DomainPill domain={data.domain} />
          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            PROVEN MIDDLEWARE
          </span>
        </div>
      </div>

      {/* Query Banner */}
      <div className="px-5 py-3 border-b border-border dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 flex items-start justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-mono text-muted block">
            Evaluated User Query
          </span>
          <p className="text-xs font-semibold text-foreground mt-0.5">&quot;{data.query}&quot;</p>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] uppercase font-mono text-muted block">LLM Engine</span>
          <span className="text-xs font-mono text-slate-600 dark:text-slate-300 font-semibold">
            Single Generation Run
          </span>
        </div>
      </div>

      {/* Two-Sided Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border dark:divide-slate-700">
        {/* LEFT: WITHOUT FIREWALL */}
        <div className="p-5 flex flex-col justify-between space-y-4 bg-red-50/20 dark:bg-red-950/10">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-red-100 dark:border-red-900/40 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-800 dark:text-red-300">
                  Without Firewall (Firewall: OFF)
                </h3>
              </div>
              <span className="text-[10px] bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded font-bold">
                UNVERIFIED AI RESPONSE
              </span>
            </div>

            <div className="text-[11px] text-muted space-y-1 font-mono">
              <p>• Delivery: <strong className="text-red-600">Direct to User (No Interception)</strong></p>
              <p>• Claim Extraction: <span className="text-slate-400">Disabled</span></p>
              <p>• Knowledge Base Check: <span className="text-slate-400">None</span></p>
              <p>• Contradiction Detection: <span className="text-slate-400">None</span></p>
            </div>

            <div className="rounded-xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 p-3.5 space-y-1.5 shadow-sm">
              <span className="text-[10px] font-mono uppercase tracking-widest text-red-600 font-bold block">
                Raw LLM Output (Delivered Unchecked)
              </span>
              <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {data.rawLlmResponse || "(No raw LLM output recorded)"}
              </p>
            </div>
          </div>

          <div className="pt-2">
            <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
              ⚠ Risk: Any hallucinations, wrong numbers, or date contradictions in the raw LLM output reach the user directly.
            </p>
          </div>
        </div>

        {/* RIGHT: WITH FIREWALL */}
        <div className="p-5 flex flex-col justify-between space-y-4 bg-emerald-50/20 dark:bg-emerald-950/10">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-emerald-100 dark:border-emerald-900/40 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  With Firewall (Firewall: ON)
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <DecisionBadge decision={data.decision} />
                {data.confidenceScore != null && data.confidenceScore > 0 && (
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 font-mono">
                    {Math.round(data.confidenceScore * 100)}%
                  </span>
                )}
              </div>
            </div>

            <div className="text-[11px] text-muted space-y-1 font-mono">
              <p>• Delivery: <strong className="text-emerald-600">Intercepted &amp; Grounded</strong></p>
              <p>• Claim Extraction: <strong className="text-foreground">Atomic Decomposition</strong></p>
              <p>• Knowledge Base Check: <strong className="text-foreground">Strict Vector &amp; Keyword Match</strong></p>
              <p>• Contradiction Check: <strong className="text-foreground">Numeric / Date / Entity Analysis</strong></p>
            </div>

            <div className={`rounded-xl p-3.5 border space-y-1.5 shadow-sm ${
              data.decision === "pass"
                ? "bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-900"
                : data.decision === "rewrite"
                  ? "bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-900"
                  : "bg-white dark:bg-slate-900 border-red-300 dark:border-red-900"
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono uppercase tracking-widest font-bold ${
                  data.decision === "pass" ? "text-emerald-600" : data.decision === "rewrite" ? "text-amber-600" : "text-red-600"
                }`}>
                  {data.decision === "pass" ? "Verified Output (PASS)" : data.decision === "rewrite" ? "Rewritten & Re-Verified Output" : "Blocked Output (Fail-Closed)"}
                </span>
                <span className="text-[10px] text-muted font-mono">Delivered to User</span>
              </div>
              <p className={`text-xs whitespace-pre-wrap leading-relaxed ${
                data.decision === "block" ? "text-red-700 dark:text-red-300 font-medium" : "text-slate-800 dark:text-slate-200"
              }`}>
                {data.finalResponse || data.rawLlmResponse || "(No final response)"}
              </p>
            </div>
          </div>

          <div className="pt-2">
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
              {data.decision === "pass" && "✓ Verified Safe: Grounded by authoritative knowledge base evidence."}
              {data.decision === "rewrite" && "✏ Corrected: Problematic claims rectified against evidence and successfully re-verified."}
              {data.decision === "block" && "✗ Blocked: Hallucinatory or contradictory claims safely intercepted."}
              {data.decision === "bypass" && "⚡ Firewall was bypassed for this query."}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DomainPill({ domain }: { domain: FirewallDomain }) {
  const color =
    domain === "healthcare" ? "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300" :
    domain === "legal" ? "border-purple-200 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300" :
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
  const label = domain === "healthcare" ? "🏥 Hospital" : domain === "legal" ? "⚖️ Legal" : "🏢 Enterprise"
  return <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${color}`}>{label}</span>
}

function DecisionBadge({ decision }: { decision: string }) {
  if (decision === "bypass") {
    return (
      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800">
        BYPASSED
      </span>
    )
  }

  const cls =
    decision === "pass" ? "border-emerald-200 bg-emerald-100 text-emerald-800" :
    decision === "rewrite" ? "border-amber-200 bg-amber-100 text-amber-800" :
    "border-red-200 bg-red-100 text-red-800"
  return (
    <span className={`text-[10px] font-bold uppercase border rounded px-1.5 py-0.5 ${cls}`}>
      {decision === "pass" ? "PASS" : decision === "rewrite" ? "REWRITE" : "BLOCK"}
    </span>
  )
}
