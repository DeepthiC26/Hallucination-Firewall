"use client"

import { useEffect, useState } from "react"
import type { Domain } from "@/types"

interface DocEntry {
  id: string
  title: string
  filename: string
  domain: Domain
  chunks: number
  createdAt: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onDocsChange: () => void
}

export default function KnowledgeBaseSidebar({ isOpen, onClose, onDocsChange }: Props) {
  const [docs, setDocs] = useState<DocEntry[]>([])
  const [domain, setDomain] = useState<Domain>("general")
  const [uploading, setUploading] = useState(false)

  async function refreshDocs() {
    const res = await fetch("/api/docs")
    const data = await res.json()
    if (Array.isArray(data)) setDocs(data)
  }

  useEffect(() => {
    if (isOpen) refreshDocs().catch(() => {})
  }, [isOpen])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [isOpen])

  async function handleUpload(file: File) {
    const form = new FormData()
    form.append("file", file)
    form.append("domain", domain)
    setUploading(true)
    try {
      const res = await fetch("/api/upload", { method: "POST", body: form })
      if (!res.ok) throw new Error("Upload failed")
      await refreshDocs()
      onDocsChange()
    } finally {
      setUploading(false)
    }
  }

  async function deleteDoc(id: string) {
    await fetch("/api/docs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    await refreshDocs()
    onDocsChange()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside className="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-white dark:bg-slate-900 border-l border-border dark:border-slate-700 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border dark:border-slate-700 px-5 py-4">
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">📚 Knowledge Base</p>
            <p className="text-xs text-slate-500 mt-0.5">Upload PDFs to any domain</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close knowledge base sidebar"
          >
            ✕
          </button>
        </div>

        {/* Upload section */}
        <div className="px-5 py-4 border-b border-border dark:border-slate-700 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Target Domain
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-border dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
              value={domain}
              onChange={(e) => setDomain(e.target.value as Domain)}
            >
              <option value="general">Auto-detect</option>
              <option value="healthcare">🏥 Healthcare</option>
              <option value="legal">⚖️ Legal</option>
              <option value="enterprise">🏢 Enterprise</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Upload PDF
            </label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleUpload(file)
              }}
              disabled={uploading}
              className="mt-1 w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-700 disabled:opacity-50"
            />
            {uploading && (
              <div className="flex items-center gap-2 mt-2">
                <span className="w-3 h-3 border-2 border-slate-400 border-t-slate-900 rounded-full animate-spin" />
                <p className="text-xs text-slate-500">Indexing knowledge…</p>
              </div>
            )}
          </div>
        </div>

        {/* Documents list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-3">
            Uploaded Documents ({docs.length})
          </p>
          {docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <span className="text-3xl">📄</span>
              <p className="text-sm text-slate-500">No documents yet</p>
              <p className="text-xs text-slate-400">Upload a PDF to add it to the knowledge base</p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => {
                const domainIcon =
                  doc.domain === "healthcare" ? "🏥" :
                  doc.domain === "legal" ? "⚖️" :
                  doc.domain === "enterprise" ? "🏢" : "📄"
                return (
                  <div
                    key={doc.id}
                    className="rounded-xl border border-border dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-sm">{domainIcon}</span>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {doc.title}
                          </p>
                        </div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                          {doc.domain} · {doc.chunks} chunks
                        </p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 px-2 py-1 rounded-md transition-colors font-semibold"
                        onClick={() => void deleteDoc(doc.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div className="border-t border-border dark:border-slate-700 px-5 py-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {docs.reduce((sum, d) => sum + d.chunks, 0)} total chunks indexed
          </p>
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 font-semibold"
          >
            Close
          </button>
        </div>
      </aside>
    </>
  )
}
