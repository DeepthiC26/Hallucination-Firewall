"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import InvestigationJourney from "@/components/platform/InvestigationJourney"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface DocOption {
  id: string
  title: string
  filename: string
  domain: string
  chunks: number
}

interface AnalyticsData {
  totalQueries: number
  passCount: number
  rewriteCount: number
  blockCount: number
  promptInjectionCount: number
  conflictingEvidenceCount: number
  averageConfidence: number
  averageResponseTimeMs: number
  averageTrustScore?: number
  averageConsistencyScore?: number
  averageRetrievalMs?: number
  averageLlmMs?: number
  averageVerificationMs?: number
  topQueriedDomain: string
  scopedDocId: string | null
  scopedDocTitle: string | null
  uniqueQuestions: number
  topQuestions: Array<{
    query: string
    count: number
    lastDecision: string
    avgConfidence: number
  }>
  recentQueries: Array<{
    id: string
    timestamp: string
    query: string
    domain: string
    decision: string
    confidenceScore: number
    docTitle?: string
    trustScore?: number
    failureClass?: string
  }>
  mostBlockedQuestions: Array<{ query: string; count: number }>
  passVsBlock: { pass: number; rewrite: number; block: number }
  confidenceDistribution: { green: number; yellow: number; red: number }
  queryTrend: Array<{ date: string; count: number }>
  trustTrend?: Array<{ date: string; avgTrust: number }>
  domainUsage: Array<{ domain: string; count: number }>
  documentUsage: Array<{ docId: string; docTitle: string; count: number }>
  domainAnalytics: Array<{
    domain: string
    queries: number
    averageConfidence: number
    averageLatencyMs: number
    averageTrustScore?: number
    hallucinationRate: number
    pass: number
    rewrite: number
    block: number
  }>
  failureClassification?: Array<{
    class: string
    label: string
    count: number
  }>
  rootCauseDistribution?: Array<{ cause: string; count: number }>
  knowledgeGapTopics?: Array<{ topic: string; count: number }>
  docs?: DocOption[]
}

const PIE_COLORS = ["#16A34A", "#D97706", "#DC2626"]

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [evalData, setEvalData] = useState<any | null>(null)
  const [evalCases, setEvalCases] = useState<any[]>([])
  const [docs, setDocs] = useState<DocOption[]>([])
  const [docId, setDocId] = useState("")
  const [domain, setDomain] = useState("all")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback((selectedDocId: string, selectedDomain: string) => {
    setLoading(true)
    setError("")
    const params = new URLSearchParams()
    if (selectedDocId) params.set("docId", selectedDocId)
    if (selectedDomain && selectedDomain !== "all") params.set("domain", selectedDomain)
    const qs = params.toString() ? `?${params.toString()}` : ""
    
    Promise.all([
      fetch(`/api/analytics${qs}`).then((r) => r.json()),
      fetch(`/api/evaluation-metrics${qs}`).then((r) => r.json())
    ])
      .then(([analyticsJson, evalJson]) => {
        setData(analyticsJson)
        if (Array.isArray(analyticsJson.docs)) setDocs(analyticsJson.docs)
        if (evalJson) {
          setEvalData(evalJson.metrics)
          setEvalCases(evalJson.cases || [])
        }
      })
      .catch(() => setError("Failed to load analytics"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load(docId, domain)
  }, [docId, domain, load])

  const passBlockData = data
    ? [
        { name: "PASS", value: data.passVsBlock.pass },
        { name: "REWRITE", value: data.passVsBlock.rewrite },
        { name: "BLOCK", value: data.passVsBlock.block },
      ]
    : []

  const confidenceData = data
    ? [
        { name: "90–100%", value: data.confidenceDistribution.green },
        { name: "60–89%", value: data.confidenceDistribution.yellow },
        { name: "<60%", value: data.confidenceDistribution.red },
      ]
    : []

  const selectedDoc = docs.find((d) => d.id === docId)

  const formatPct = (val: number | null | undefined) => (val != null ? `${(val * 100).toFixed(1)}%` : "N/A")

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted mt-1">
            Step 5 — organisational verification behaviour: hallucination categories, reasoning
            failures, weak knowledge, and trends — for improvement, not vanity metrics.
          </p>
        </div>
        <Link
          href="/dashboard/history"
          className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white font-semibold shrink-0"
        >
          Adaptive Memory →
        </Link>
      </div>

      <InvestigationJourney current="analytics" />

      <div className="rounded-xl border border-border bg-white p-4 flex flex-col sm:flex-row sm:items-end gap-3 dark:bg-slate-900 dark:border-slate-700">
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Domain filter</label>
            <select
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            >
              <option value="all">All Documents / Domains</option>
              <option value="enterprise">Enterprise</option>
              <option value="legal">Legal</option>
              <option value="healthcare">Healthcare</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Dataset / Document Scope</label>
            <select
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600"
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
            >
              <option value="">All Datasets &amp; Documents (Global)</option>
              {docs.filter((d: any) => d.isDataset).length > 0 && (
                <optgroup label="Datasets">
                  {docs
                    .filter((d: any) => d.isDataset)
                    .map((d: any) => (
                      <option key={d.id} value={d.id}>
                        📦 {d.datasetName || d.title} ({d.sourceFiles?.length || 1} files)
                      </option>
                    ))}
                </optgroup>
              )}
              {docs.filter((d: any) => !d.isDataset).length > 0 && (
                <optgroup label="Individual Documents">
                  {docs
                    .filter((d: any) => !d.isDataset)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        📄 {d.title} · {d.filename}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !data ? (
          <p className="text-sm text-slate-500">Loading analytics…</p>
        ) : !data ? null : (
          <>
            {evalData && evalData.status !== "NO_DATA" && (
              <div id="firewall-performance" className="mb-8 space-y-4 rounded-xl border border-border bg-slate-50 dark:bg-slate-800/40 p-4">
                <h2 className="text-lg font-semibold border-b border-border pb-2 flex items-center gap-2">
                  <span>Firewall Performance (Effectiveness)</span>
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">Ground Truth Evaluated</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Accuracy" value={formatPct(evalData.accuracy)} tooltip="Total correct predictions / Total evaluated cases" />
                  <MetricCard label="Macro Precision" value={formatPct(evalData.macroPrecision)} tooltip="Average of precision across all classes" />
                  <MetricCard label="Macro Recall" value={formatPct(evalData.macroRecall)} tooltip="Average of recall across all classes" />
                  <MetricCard label="F1 Score" value={formatPct(evalData.f1Score)} tooltip="Harmonic mean of precision and recall" />
                  <MetricCard label="Evidence Retrieval Recall" value={formatPct(evalData.evidenceRetrievalRecall)} tooltip="Cases where expected evidence was retrieved / Total evaluated cases" />
                  <MetricCard label="Claim Verification Accuracy" value={formatPct(evalData.claimVerificationAccuracy)} tooltip="Cases where all claims were verified correctly / Total evaluated cases" />
                  <MetricCard label="Consistency Rate" value={formatPct(evalData.consistencyRate)} tooltip="Cases where firewall decisions match between repeated queries / Total evaluated cases" />
                </div>
                
                <details className="mt-4 border border-border rounded-lg bg-white dark:bg-slate-900">
                  <summary className="p-3 text-sm font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    How are these metrics calculated? (View {evalCases.length} Evaluation Cases)
                  </summary>
                  <div className="p-4 border-t border-border overflow-x-auto">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <th className="py-2 px-3 font-semibold text-slate-500">Case ID</th>
                          <th className="py-2 px-3 font-semibold text-slate-500">Query</th>
                          <th className="py-2 px-3 font-semibold text-slate-500">Expected</th>
                          <th className="py-2 px-3 font-semibold text-slate-500">Actual</th>
                          <th className="py-2 px-3 font-semibold text-slate-500">Evidence Retrieved</th>
                          <th className="py-2 px-3 font-semibold text-slate-500">Consistent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evalCases.map((c, i) => (
                          <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-2 px-3 text-slate-500">{c.testCase.id}</td>
                            <td className="py-2 px-3 truncate max-w-[200px]" title={c.testCase.question}>{c.testCase.question}</td>
                            <td className="py-2 px-3"><StatusBadge decision={c.testCase.expectedDecision} /></td>
                            <td className="py-2 px-3">
                              {c.result ? <StatusBadge decision={c.result.actualDecision} /> : <span className="text-slate-400">Not run</span>}
                            </td>
                            <td className="py-2 px-3">{c.result ? (c.result.actualEvidenceRetrieved ? "✅" : "❌") : "-"}</td>
                            <td className="py-2 px-3">{c.result ? (c.result.isConsistent ? "✅" : "❌") : "-"}</td>
                          </tr>
                        ))}
                        {evalCases.length === 0 && (
                          <tr><td colSpan={6} className="py-4 text-center text-slate-500">No evaluation cases found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            )}

            <div className="mb-4 mt-8">
              <h2 className="text-lg font-semibold border-b border-border pb-2 flex items-center gap-2">
                <span>Operational Analytics</span>
                <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">Live Traffic</span>
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
              <MetricCard label="Investigations (scope)" value={String(data.totalQueries)} />
              <MetricCard label="Unique questions" value={String(data.uniqueQuestions)} />
              <MetricCard label="PASS" value={String(data.passCount)} tone="green" />
              <MetricCard label="REWRITE" value={String(data.rewriteCount)} tone="amber" />
              <MetricCard label="BLOCK" value={String(data.blockCount)} tone="red" />
              <MetricCard
                label="Avg Confidence"
                value={`${Math.round(data.averageConfidence * 100)}%`}
              />
              <MetricCard
                label="Avg Trust"
                value={`${Math.round((data.averageTrustScore || 0) * 100)}%`}
              />
              <MetricCard
                label="Avg Response"
                value={`${data.averageResponseTimeMs} ms`}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
              <MetricCard
                label="Hallucination Rate"
                value={`${Math.round(((data as { hallucinationRate?: number }).hallucinationRate || 0) * 100)}%`}
                tone="red"
              />
              <MetricCard
                label="Evidence Strength"
                value={`${(data as { averageEvidenceStrength?: number }).averageEvidenceStrength || 0}%`}
              />
              <MetricCard
                label="Governance"
                value={`${(data as { averageGovernanceScore?: number }).averageGovernanceScore || 0}%`}
              />
              <MetricCard
                label="Avg Consistency"
                value={`${Math.round((data.averageConsistencyScore || 0) * 100)}%`}
              />
              <MetricCard
                label="Avg Retrieval"
                value={`${data.averageRetrievalMs || 0} ms`}
              />
              <MetricCard
                label="Avg Verify"
                value={`${data.averageVerificationMs || 0} ms`}
              />
            </div>

            {data.domainAnalytics?.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-2">Per-Domain Breakdown</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {data.domainAnalytics.map((row) => (
                    <DomainAnalyticsCard key={row.domain} row={row} />
                  ))}
                </div>
              </div>
            )}


            {!!data.failureClassification?.length && (
              <div className="rounded-xl border border-border bg-white p-4 dark:bg-slate-900 dark:border-slate-700">
                <p className="text-xs font-mono font-semibold uppercase tracking-widest text-slate-500 mb-3">
                  Failure Classification (blocked)
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {data.failureClassification.map((f) => (
                    <div
                      key={f.class}
                      className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 dark:bg-red-950/30 dark:border-red-900"
                    >
                      <p className="text-[10px] text-red-700 font-semibold">{f.label}</p>
                      <p className="text-xl font-semibold text-red-900 dark:text-red-200">{f.count}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!!data.rootCauseDistribution?.length && (
              <div className="rounded-xl border border-border bg-white p-4 dark:bg-slate-900 dark:border-slate-700">
                <p className="text-xs font-mono font-semibold uppercase tracking-widest text-slate-500 mb-3">
                  Root Cause Distribution
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {data.rootCauseDistribution.map((r) => (
                    <div
                      key={r.cause}
                      className="rounded-lg border border-border px-3 py-2 dark:border-slate-700"
                    >
                      <p className="text-[10px] text-muted font-semibold">{r.cause}</p>
                      <p className="text-lg font-semibold">{r.count}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!!data.knowledgeGapTopics?.length && (
              <div className="rounded-xl border border-border bg-white p-4 dark:bg-slate-900 dark:border-slate-700">
                <p className="text-xs font-mono font-semibold uppercase tracking-widest text-slate-500 mb-3">
                  Knowledge Gaps (upload recommendations)
                </p>
                <ul className="text-sm space-y-1">
                  {data.knowledgeGapTopics.map((g) => (
                    <li key={g.topic}>
                      {g.topic} · signal {g.count}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-border bg-white p-4">
              <p className="text-xs text-slate-500 mb-1">Scope</p>
              <p className="text-lg font-semibold">
                {data.scopedDocTitle || selectedDoc?.title || "All documents"}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="PASS vs BLOCK (this PDF / scope)">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={passBlockData} dataKey="value" nameKey="name" outerRadius={80} label>
                      {passBlockData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Confidence Distribution">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={confidenceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0891B2" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Query Trend">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={data.queryTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#7C3AED" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Trust Score Trend">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart
                    data={(data.trustTrend || []).map((r) => ({
                      date: r.date,
                      trust: Math.round(r.avgTrust * 100),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="trust" stroke="#0F766E" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title={docId ? "Decision mix" : "Queries by document"}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={
                      docId
                        ? passBlockData
                        : data.documentUsage.map((d) => ({
                            name: d.docTitle.slice(0, 18),
                            value: d.count,
                          }))
                    }
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#16A34A" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Domain distribution stacked bar */}
            {data.domainAnalytics?.length > 0 && (
              <ChartCard title="Queries by Domain — Pass / Rewrite / Block">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={data.domainAnalytics.map((r) => ({
                      name:
                        r.domain === "healthcare" ? "🏥 Healthcare" :
                        r.domain === "legal" ? "⚖️ Legal" : "🏢 Enterprise",
                      pass: r.pass,
                      rewrite: r.rewrite,
                      block: r.block,
                    }))}
                    margin={{ left: 0, right: 8, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="pass" fill="#16A34A" stackId="a" name="PASS" />
                    <Bar dataKey="rewrite" fill="#D97706" stackId="a" name="REWRITE" />
                    <Bar dataKey="block" fill="#DC2626" stackId="a" radius={[4,4,0,0]} name="BLOCK" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-white p-4">
                <h2 className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  Top questions asked {docId ? "on this PDF" : ""}
                </h2>
                <div className="space-y-2 max-h-80 overflow-auto">
                  {data.topQuestions.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No questions yet for this scope. Ask about the PDF on the dashboard.
                    </p>
                  ) : (
                    data.topQuestions.map((item, i) => (
                      <div
                        key={`${item.query}-${i}`}
                        className="rounded-lg border border-border p-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <StatusBadge decision={item.lastDecision} />
                          <span className="text-[10px] font-mono text-slate-500">
                            {item.count}× · {Math.round(item.avgConfidence * 100)}% avg
                          </span>
                        </div>
                        <p className="text-xs text-slate-800 mt-1">{item.query}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-white p-4">
                <h2 className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-widest mb-3">
                  Recent queries {docId ? "(this PDF)" : ""}
                </h2>
                <div className="space-y-2 max-h-80 overflow-auto">
                  {data.recentQueries.length === 0 ? (
                    <p className="text-xs text-slate-500">No queries yet.</p>
                  ) : (
                    data.recentQueries.map((q) => (
                      <div key={q.id} className="rounded-lg border border-border p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono uppercase text-slate-500">
                            {q.docTitle || q.domain}
                          </span>
                          <StatusBadge decision={q.decision} />
                        </div>
                        <p className="text-xs text-slate-800 mt-1 line-clamp-2">{q.query}</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(q.timestamp).toLocaleString()} ·{" "}
                          {Math.round((q.confidenceScore || 0) * 100)}%
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone,
  tooltip,
}: {
  label: string
  value: string
  tone?: "green" | "amber" | "red"
  tooltip?: string
}) {
  const toneClass =
    tone === "green"
      ? "border-green-200 bg-green-50"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50"
        : tone === "red"
          ? "border-red-200 bg-red-50"
          : "border-border bg-white"

  return (
    <div className={`rounded-xl border p-3 relative group ${toneClass}`}>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide flex justify-between items-center gap-1">
        <span>{label}</span>
        {tooltip && <span className="cursor-help shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] text-slate-600 dark:text-slate-300">?</span>}
      </p>
      <p className="text-xl font-semibold text-slate-900 mt-1">{value}</p>
      {tooltip && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[105%] mb-2 hidden group-hover:block w-48 p-2 bg-slate-800 text-white text-xs rounded z-10 text-center shadow-lg pointer-events-none">
          {tooltip}
        </div>
      )}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <h2 className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-widest mb-3">
        {title}
      </h2>
      {children}
    </div>
  )
}

function StatusBadge({ decision }: { decision: string }) {
  const cls =
    decision === "pass"
      ? "bg-green-100 text-green-800 border-green-200"
      : decision === "rewrite"
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-red-100 text-red-800 border-red-200"
  return (
    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${cls}`}>
      {decision}
    </span>
  )
}

function DomainAnalyticsCard({
  row,
}: {
  row: {
    domain: string
    queries: number
    averageConfidence: number
    averageLatencyMs: number
    averageTrustScore?: number
    hallucinationRate: number
    pass: number
    rewrite: number
    block: number
  }
}) {
  const total = row.pass + row.rewrite + row.block || 1
  const passP = (row.pass / total) * 100
  const rewriteP = (row.rewrite / total) * 100
  const blockP = (row.block / total) * 100

  const domainIcon = row.domain === "healthcare" ? "🏥" : row.domain === "legal" ? "⚖️" : "🏢"
  const domainColor =
    row.domain === "healthcare"
      ? "border-blue-200 bg-blue-50 dark:bg-blue-950/20"
      : row.domain === "legal"
        ? "border-purple-200 bg-purple-50 dark:bg-purple-950/20"
        : "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20"

  return (
    <div className={`rounded-xl border-2 p-4 space-y-3 dark:border-slate-700 ${domainColor}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{domainIcon}</span>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            {row.domain}
          </p>
        </div>
        <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{row.queries}</p>
      </div>

      {/* Pass/Rewrite/Block rate bar */}
      {row.queries > 0 && (
        <div>
          <div className="flex rounded-full overflow-hidden h-2 gap-0.5">
            {passP > 0 && <div className="bg-emerald-500" style={{ width: `${passP}%` }} />}
            {rewriteP > 0 && <div className="bg-amber-500" style={{ width: `${rewriteP}%` }} />}
            {blockP > 0 && <div className="bg-red-500" style={{ width: `${blockP}%` }} />}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-slate-500">
            <span className="text-emerald-600 font-semibold">✓ {row.pass} pass</span>
            {row.rewrite > 0 && <span className="text-amber-600 font-semibold">✏ {row.rewrite} rewrite</span>}
            <span className="text-red-600 font-semibold">✗ {row.block} block</span>
          </div>
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/60 dark:bg-slate-800/60 px-2 py-1.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Confidence</p>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {Math.round(row.averageConfidence * 100)}%
          </p>
        </div>
        <div className="rounded-lg bg-white/60 dark:bg-slate-800/60 px-2 py-1.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Trust</p>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {Math.round((row.averageTrustScore ?? 0) * 100)}%
          </p>
        </div>
        <div className="rounded-lg bg-white/60 dark:bg-slate-800/60 px-2 py-1.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Latency</p>
          <p className="text-sm font-bold">{row.averageLatencyMs} ms</p>
        </div>
        <div className="rounded-lg bg-white/60 dark:bg-slate-800/60 px-2 py-1.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Hallucination</p>
          <p className={`text-sm font-bold ${row.hallucinationRate > 0.1 ? "text-red-600" : "text-slate-900 dark:text-slate-100"}`}>
            {(row.hallucinationRate * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {row.queries === 0 && (
        <p className="text-xs text-slate-400 italic">No queries yet for this domain</p>
      )}
    </div>
  )
}
