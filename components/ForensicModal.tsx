"use client"

import { useEffect, useRef } from "react"
import type { FirewallDomain } from "@/types"

interface ForensicData {
  query: string
  domain: FirewallDomain
  firewallEnabled: boolean
  rawLlmResponse: string
  finalResponse: string
  decision: string
  confidenceScore: number | null
  trustScore: number | null
  reason: string | null
  claims: Array<{
    claimId: string
    claim: string
    numericStatus?: string
    numericNote?: string
    dateStatus?: string
    dateNote?: string
    entityStatus?: string
    entityNote?: string
  }>
  numericChecks: { checkedClaims: number; mismatches: number } | null
  dateChecks: { checkedClaims: number; mismatches: number } | null
  entityChecks: { checkedClaims: number; mismatches: number } | null
  domainVerification: {
    adjustedConfidence: number
    evidenceFound: number
    unsupportedClaims: string[]
  } | null
}

interface Props {
  data: ForensicData | null
  onClose: () => void
}

export default function ForensicModal({ data, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  if (!data) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-border dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-lg">🔬</span>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Inspect Verification — Forensic View</h2>
            <DomainPill domain={data.domain} />
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 text-lg"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Decision Banner */}
          <div className={`rounded-xl border-2 px-5 py-4 flex items-center justify-between ${
            data.decision === "pass" ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20" :
            data.decision === "rewrite" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20" :
            "border-red-300 bg-red-50 dark:bg-red-950/20"
          }`}>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-1">Firewall Decision</p>
              <DecisionBadge decision={data.decision} size="lg" />
              {data.reason && <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 max-w-2xl">{data.reason}</p>}
            </div>
            <div className="text-right">
              {data.confidenceScore != null && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Confidence</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{Math.round(data.confidenceScore * 100)}%</p>
                </div>
              )}
              {data.trustScore != null && (
                <div className="mt-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Trust</p>
                  <p className="text-lg font-semibold">{Math.round(data.trustScore * 100)}%</p>
                </div>
              )}
            </div>
          </div>

          {/* Query + Firewall Status */}
          <Section title="Query">
            <p className="text-sm text-slate-800 dark:text-slate-200">{data.query}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${data.firewallEnabled ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-red-300 bg-red-50 text-red-700"}`}>
                {data.firewallEnabled ? "🛡 Firewall ON" : "⚡ Firewall OFF — Response Unverified"}
              </span>
              <DomainPill domain={data.domain} />
            </div>
          </Section>

          {/* Raw vs Final Response */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="Raw LLM Response">
              <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                {data.rawLlmResponse || "(Not available — Firewall may be disabled)"}
              </pre>
            </Section>
            <Section title="Final Response (After Firewall)">
              <pre className={`text-xs whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto ${
                data.decision === "block" ? "text-red-700 dark:text-red-400" : "text-slate-700 dark:text-slate-300"
              }`}>
                {data.finalResponse || "(No verified response)"}
              </pre>
            </Section>
          </div>

          {/* Consistency Checks Summary */}
          {(data.numericChecks || data.dateChecks || data.entityChecks) && (
            <Section title="Consistency Check Results">
              <div className="grid grid-cols-3 gap-3">
                {data.numericChecks && (
                  <ConsistencyCard
                    label="Numeric Consistency"
                    icon="🔢"
                    mismatches={data.numericChecks.mismatches}
                    total={data.numericChecks.checkedClaims}
                  />
                )}
                {data.dateChecks && (
                  <ConsistencyCard
                    label="Date Consistency"
                    icon="📅"
                    mismatches={data.dateChecks.mismatches}
                    total={data.dateChecks.checkedClaims}
                  />
                )}
                {data.entityChecks && (
                  <ConsistencyCard
                    label="Entity Consistency"
                    icon="🏷"
                    mismatches={data.entityChecks.mismatches}
                    total={data.entityChecks.checkedClaims}
                  />
                )}
              </div>
            </Section>
          )}

          {/* Domain Verification */}
          {data.domainVerification && (
            <Section title={`Domain Verification (${data.domain})`}>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="rounded-lg border border-border dark:border-slate-700 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Adjusted Confidence</p>
                  <p className="text-xl font-bold">{Math.round(data.domainVerification.adjustedConfidence * 100)}%</p>
                </div>
                <div className="rounded-lg border border-border dark:border-slate-700 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Evidence-Grounded Claims</p>
                  <p className="text-xl font-bold">{data.domainVerification.evidenceFound}</p>
                </div>
              </div>
              {data.domainVerification.unsupportedClaims.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Unsupported Claims</p>
                  {data.domainVerification.unsupportedClaims.map((u, i) => (
                    <p key={i} className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-1">
                      {u.replace("⚠ ", "")}
                    </p>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Per-Claim Details */}
          {data.claims.length > 0 && (
            <Section title={`Claim-Level Verification (${data.claims.length} claims)`}>
              <div className="space-y-3">
                {data.claims.map((c, i) => (
                  <div key={c.claimId} className="rounded-lg border border-border dark:border-slate-700 p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-[10px] font-mono text-slate-400 flex-shrink-0 mt-0.5">#{i + 1}</span>
                      <p className="text-xs text-slate-800 dark:text-slate-200">{c.claim}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {c.numericStatus && c.numericStatus !== "not_applicable" && (
                        <DetailPill
                          label={`Numeric: ${c.numericStatus}`}
                          note={c.numericNote}
                          status={c.numericStatus}
                        />
                      )}
                      {c.dateStatus && c.dateStatus !== "not_applicable" && (
                        <DetailPill
                          label={`Date: ${c.dateStatus}`}
                          note={c.dateNote}
                          status={c.dateStatus}
                        />
                      )}
                      {c.entityStatus && c.entityStatus !== "not_applicable" && (
                        <DetailPill
                          label={`Entity: ${c.entityStatus}`}
                          note={c.entityNote}
                          status={c.entityStatus}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border dark:border-slate-700 px-6 py-3 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-2">{title}</p>
      <div className="rounded-xl border border-border dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-800/30">
        {children}
      </div>
    </div>
  )
}

function DomainPill({ domain }: { domain: FirewallDomain }) {
  const color =
    domain === "healthcare" ? "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300" :
    domain === "legal" ? "border-purple-200 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300" :
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
  const label = domain === "healthcare" ? "🏥 Healthcare" : domain === "legal" ? "⚖️ Legal" : "🏢 Enterprise"
  return <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${color}`}>{label}</span>
}

function DecisionBadge({ decision, size = "sm" }: { decision: string; size?: "sm" | "lg" }) {
  const cls =
    decision === "pass" ? "border-emerald-300 bg-emerald-100 text-emerald-800" :
    decision === "rewrite" ? "border-amber-300 bg-amber-100 text-amber-800" :
    "border-red-300 bg-red-100 text-red-800"
  const label = decision === "pass" ? "✓ PASS" : decision === "rewrite" ? "✏ REWRITE" : "✗ BLOCK"
  return (
    <span className={`font-bold uppercase border rounded-lg px-3 py-1 ${size === "lg" ? "text-base" : "text-xs"} ${cls}`}>
      {label}
    </span>
  )
}

function ConsistencyCard({ label, icon, mismatches, total }: { label: string; icon: string; mismatches: number; total: number }) {
  const ok = mismatches === 0
  return (
    <div className={`rounded-lg border p-3 text-center ${ok ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20" : "border-amber-200 bg-amber-50 dark:bg-amber-950/20"}`}>
      <p className="text-lg">{icon}</p>
      <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 mt-1">{label}</p>
      <p className={`text-xl font-bold mt-1 ${ok ? "text-emerald-700" : "text-amber-700"}`}>
        {ok ? "✓ OK" : `${mismatches} ⚠`}
      </p>
      <p className="text-[10px] text-slate-400">{total} claims checked</p>
    </div>
  )
}

function DetailPill({ label, note, status }: { label: string; note?: string; status: string }) {
  const color =
    status === "pass" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
    status === "mismatch" ? "border-amber-200 bg-amber-50 text-amber-700" :
    "border-slate-200 bg-slate-50 text-slate-600"
  return (
    <div className={`rounded px-2 py-1 border text-[11px] font-semibold ${color}`} title={note}>
      {label}
      {note && <span className="font-normal ml-1 opacity-75">— {note}</span>}
    </div>
  )
}
