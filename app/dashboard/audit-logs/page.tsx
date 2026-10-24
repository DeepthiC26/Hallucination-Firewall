"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { AuditEntry, FirewallDomain } from "@/types"
import { toFirewallDomain } from "@/lib/domains/domain_detector"

function decisionBadge(decision: string) {
  if (decision === "pass") return "bg-green-100 text-green-800 border-green-200"
  if (decision === "rewrite") return "bg-amber-100 text-amber-800 border-amber-200"
  return "bg-red-100 text-red-800 border-red-200"
}

export default function AuditLogsPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [domainFilter, setDomainFilter] = useState<"all" | FirewallDomain>("all")
  const [decisionFilter, setDecisionFilter] = useState("all")

  const fetchLogs = useCallback(() => {
    setLoading(true)
    fetch("/api/audit-log")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setEntries(data)
        else setError("Failed to load audit logs")
      })
      .catch(() => setError("Failed to load audit logs"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const fd = (e.firewallDomain || toFirewallDomain(e.domain)) as FirewallDomain
      if (domainFilter !== "all" && fd !== domainFilter) return false
      if (decisionFilter !== "all" && e.decision !== decisionFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const hay = `${e.query} ${e.reason} ${e.docTitle || ""}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [entries, domainFilter, decisionFilter, search])

  const deleteIds = async (ids: string[]) => {
    if (!ids.length) return
    setDeleting(true)
    try {
      const res = await fetch("/api/audit-log", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      if (!res.ok) throw new Error("Delete failed")
      setEntries((prev) => prev.filter((e) => !ids.includes(e.id)))
      setSelected(new Set())
    } catch {
      setError("Could not delete entries")
    } finally {
      setDeleting(false)
    }
  }

  const exportCsv = () => {
    const rows = [
      ["Timestamp", "Domain", "Question", "Decision", "Reason", "User", "Confidence", "Trust"].join(","),
      ...filtered.map((e) =>
        [
          e.timestamp,
          e.firewallDomain || e.domain,
          JSON.stringify(e.query),
          e.decision,
          JSON.stringify(e.reason || ""),
          e.user || "",
          e.confidenceScore ?? "",
          e.trustScore ?? e.safety?.extendedTrust?.finalTrustScore ?? "",
        ].join(",")
      ),
    ]
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `audit-logs-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPdf = () => {
    const w = window.open("", "_blank")
    if (!w) return
    w.document.write(`<html><head><title>Audit Logs</title>
      <style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%;font-size:12px}
      th,td{border:1px solid #ccc;padding:6px;text-align:left}</style></head><body>
      <h1>Hallucination Firewall — Audit Logs</h1>
      <table><thead><tr>
      <th>Timestamp</th><th>Domain</th><th>Question</th><th>Decision</th><th>Reason</th><th>Confidence</th><th>Trust</th>
      </tr></thead><tbody>
      ${filtered
        .map(
          (e) => `<tr>
        <td>${e.timestamp}</td>
        <td>${e.firewallDomain || e.domain}</td>
        <td>${e.query.replace(/</g, "&lt;")}</td>
        <td>${e.decision}</td>
        <td>${(e.reason || "").replace(/</g, "&lt;")}</td>
        <td>${Math.round((e.confidenceScore || 0) * 100)}%</td>
        <td>${Math.round(((e.trustScore ?? e.safety?.extendedTrust?.finalTrustScore) || 0) * 100)}%</td>
      </tr>`
        )
        .join("")}
      </tbody></table></body></html>`)
    w.document.close()
    w.print()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Audit Logs</h1>
        <p className="text-sm text-muted mt-1">
          Transparent, searchable record of every firewall decision.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <input
          className="rounded-lg border border-border px-3 py-2 text-sm flex-1 min-w-[180px] dark:bg-slate-800 dark:border-slate-600"
          placeholder="Search question / reason…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border border-border px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600"
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value as typeof domainFilter)}
        >
          <option value="all">All domains</option>
          <option value="enterprise">Enterprise</option>
          <option value="legal">Legal</option>
          <option value="healthcare">Healthcare</option>
        </select>
        <select
          className="rounded-lg border border-border px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-600"
          value={decisionFilter}
          onChange={(e) => setDecisionFilter(e.target.value)}
        >
          <option value="all">All decisions</option>
          <option value="pass">PASS</option>
          <option value="rewrite">REWRITE</option>
          <option value="block">BLOCK</option>
        </select>
        <button
          type="button"
          onClick={exportCsv}
          className="px-3 py-2 rounded-lg border border-border text-xs dark:border-slate-600"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={exportPdf}
          className="px-3 py-2 rounded-lg border border-border text-xs dark:border-slate-600"
        >
          Export PDF
        </button>
        <button
          type="button"
          disabled={deleting || selected.size === 0}
          onClick={() => deleteIds([...selected])}
          className="px-3 py-2 rounded-lg border border-red-200 text-xs text-red-700 disabled:opacity-40"
        >
          Delete selected
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="rounded-xl border border-border bg-white dark:bg-slate-900 dark:border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onChange={() => {
                      if (selected.size === filtered.length) setSelected(new Set())
                      else setSelected(new Set(filtered.map((e) => e.id)))
                    }}
                  />
                </th>
                <th className="px-3 py-2">Timestamp</th>
                <th className="px-3 py-2">Domain</th>
                <th className="px-3 py-2">Question</th>
                <th className="px-3 py-2">Decision</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Conf</th>
                <th className="px-3 py-2">Trust</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t border-border dark:border-slate-700 align-top">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(e.id)}
                      onChange={() => {
                        setSelected((prev) => {
                          const next = new Set(prev)
                          if (next.has(e.id)) next.delete(e.id)
                          else next.add(e.id)
                          return next
                        })
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-[11px] font-mono">
                    {new Date(e.timestamp).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 capitalize text-xs">
                    {e.firewallDomain || toFirewallDomain(e.domain)}
                  </td>
                  <td className="px-3 py-2 max-w-[220px]">{e.query}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${decisionBadge(e.decision)}`}
                    >
                      {e.decision}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted max-w-[200px]">{e.reason}</td>
                  <td className="px-3 py-2 text-xs">{e.user || "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {Math.round((e.confidenceScore || 0) * 100)}%
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {Math.round(
                      ((e.trustScore ?? e.safety?.extendedTrust?.finalTrustScore) || 0) * 100
                    )}
                    %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="p-6 text-center text-sm text-muted">No audit entries match filters.</p>
          )}
        </div>
      )}
    </div>
  )
}
