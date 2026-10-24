"use client"

import { useEffect, useState } from "react"
import type { Domain } from "@/types"

interface DocOption {
  id: string
  title: string
  filename: string
  domain: Domain
  chunks: number
}

interface Props {
  onSubmit: (query: string, domain: Domain, docId?: string) => void
  isLoading: boolean
  /** Refresh token from parent when KB docs change. */
  docsVersion?: number
}

export default function QueryInput({ onSubmit, isLoading, docsVersion = 0 }: Props) {
  const [query, setQuery] = useState("")
  const [docs, setDocs] = useState<DocOption[]>([])
  const [docId, setDocId] = useState("")
  const [loadingDocs, setLoadingDocs] = useState(true)

  useEffect(() => {
    setLoadingDocs(true)
    fetch("/api/docs")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDocs(data)
          setDocId((prev) => {
            if (prev && data.some((d: DocOption) => d.id === prev)) return prev
            return data[0]?.id || ""
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoadingDocs(false))
  }, [docsVersion])

  const selected = docs.find((d) => d.id === docId)

  const submit = () => {
    const text = query.trim()
    if (!text || !docId) return
    onSubmit(text, selected?.domain || "general", docId)
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-slate-600">Document (PDF)</label>
        <select
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
          value={docId}
          onChange={(e) => setDocId(e.target.value)}
          disabled={loadingDocs || docs.length === 0}
        >
          {docs.length === 0 ? (
            <option value="">Upload a PDF in Knowledge Base first</option>
          ) : (
            docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} ({d.chunks} chunks)
              </option>
            ))
          )}
        </select>
        {selected && (
          <p className="mt-1 text-[10px] text-slate-500">
            Analysis scoped to <span className="font-semibold">{selected.filename}</span> ·{" "}
            {selected.domain}
          </p>
        )}
      </div>

      <label className="text-xs font-medium text-slate-600">Your question</label>
      <textarea
        className="w-full min-h-28 rounded-lg border border-border px-3 py-2 text-sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={
          docId
            ? "Ask anything about this PDF — OpenRouter answers from its content, then the firewall verifies…"
            : "Upload a PDF first, then ask a question…"
        }
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
      />

      <button
        className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        onClick={submit}
        disabled={isLoading || !query.trim() || !docId}
      >
        {isLoading ? "Running..." : "Run Firewall"}
      </button>

      {!docId && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
          Open Knowledge Base → upload a PDF, then select it here to ask questions.
        </p>
      )}
    </div>
  )
}
