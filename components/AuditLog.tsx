"use client"

import type { AuditEntry } from "@/types"

interface Props {
  entries: AuditEntry[]
}

export default function AuditLog({ entries }: Props) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">No audit entries yet.</p>
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-slate-500 border-b">
            <th className="py-2 pr-2">Time</th>
            <th className="py-2 pr-2">Domain</th>
            <th className="py-2 pr-2">Decision</th>
            <th className="py-2 pr-2">Confidence</th>
            <th className="py-2">Query</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-slate-100">
              <td className="py-2 pr-2 whitespace-nowrap">{new Date(entry.timestamp).toLocaleTimeString()}</td>
              <td className="py-2 pr-2 uppercase">{entry.domain}</td>
              <td className="py-2 pr-2 uppercase">{entry.decision}</td>
              <td className="py-2 pr-2">{Math.round(entry.confidenceScore * 100)}%</td>
              <td className="py-2">{entry.query}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
