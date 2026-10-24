"use client"

import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toFirewallDomain } from "@/lib/domains/domain_detector"
import InvestigationJourney from "@/components/platform/InvestigationJourney"

interface DatasetSourceFile {
  id: string
  filename: string
  relativePath?: string
  fileType: string
  sizeBytes: number
  chunks: number
  pages?: number
  sheets?: Array<{ name: string; rowCount: number; columns: string[] }>
  totalRows?: number
  schema?: {
    columns: string[]
    columnTypes: Record<string, string>
  }
  status: "READY" | "PARTIALLY_READY" | "FAILED"
  warning?: string
}

interface RealDatasetHealth {
  filesDiscovered: number
  filesProcessed: number
  filesFailed: number
  pdfPages: number
  excelSheets: number
  csvRows: number
  totalRows: number
  chunksCreated: number
  chunksIndexed: number
  embeddingCoveragePercent: number
  extractionErrors: string[]
  unreadableFiles: string[]
  duplicateFiles: string[]
  healthScorePercent: number
  status: "READY" | "PARTIALLY_READY" | "FAILED" | "INDEXING" | "PROCESSING" | "UPLOADING"
  relationshipSummary?: string[]
}

interface DocRow {
  id: string
  title: string
  filename: string
  domain: string
  chunks: number
  pages?: number
  fileType?: string
  embeddingStatus?: string
  indexedStatus?: string
  firewallDomain?: string
  createdAt: string
  isDataset?: boolean
  datasetId?: string
  datasetName?: string
  version?: number
  sourceFiles?: DatasetSourceFile[]
  datasetHealth?: RealDatasetHealth
  status?: string
  relationshipSummary?: string[]
}

type UploadDomain = "enterprise" | "legal" | "healthcare"
type UploadTab = "files" | "folder" | "zip"

export default function KnowledgeBasePage() {
  const router = useRouter()
  const [docs, setDocs] = useState<DocRow[]>([])
  const [domain, setDomain] = useState<UploadDomain>("enterprise")
  const [uploadTab, setUploadTab] = useState<UploadTab>("files")
  const [datasetNameInput, setDatasetNameInput] = useState("")
  const [uploading, setUploading] = useState(false)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [lastDataset, setLastDataset] = useState<DocRow | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [healthModalDoc, setHealthModalDoc] = useState<DocRow | null>(null)

  const folderInputRef = useRef<HTMLInputElement>(null)
  const filesInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    fetch("/api/docs")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDocs(data)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleFilesSelected = async (fileList: FileList | File[], customDatasetName?: string) => {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    setError("")
    setLastDataset(null)

    try {
      const fd = new FormData()
      const filesArray = Array.from(fileList)

      filesArray.forEach((f) => {
        fd.append("files", f)
      })

      fd.append("domain", domain)
      if (customDatasetName || datasetNameInput.trim()) {
        fd.append("datasetName", customDatasetName || datasetNameInput.trim())
      }

      const res = await fetch("/api/datasets", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Dataset ingestion failed")

      const created = (json.dataset || json.doc) as DocRow
      setLastDataset(created)
      if (created?.id) setExpandedId(created.id)
      setDatasetNameInput("")
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleRetryIndexing = async (datasetId: string) => {
    setRetryingId(datasetId)
    setError("")
    try {
      const res = await fetch("/api/datasets/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Retry indexing failed")
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed")
    } finally {
      setRetryingId(null)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Are you sure you want to delete this dataset / document?")) return
    try {
      const res = await fetch("/api/docs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        if (expandedId === id) setExpandedId(null)
        load()
      }
    } catch {
      // ignore
    }
  }

  // Calculate real aggregated corpus metrics across all indexed datasets
  const totalDatasets = docs.filter((d) => d.isDataset).length
  const totalFilesCount = docs.reduce((acc, d) => acc + (d.sourceFiles?.length || 1), 0)
  const totalPdfPages = docs.reduce(
    (acc, d) => acc + (d.datasetHealth?.pdfPages || d.pages || 0),
    0
  )
  const totalSheets = docs.reduce((acc, d) => acc + (d.datasetHealth?.excelSheets || 0), 0)
  const totalRows = docs.reduce(
    (acc, d) => acc + (d.datasetHealth?.totalRows || d.datasetHealth?.csvRows || 0),
    0
  )
  const totalChunks = docs.reduce((acc, d) => acc + d.chunks, 0)
  const readyDatasetsCount = docs.filter((d) => (d.status || d.indexedStatus) === "READY" || (d.status || d.indexedStatus) === "indexed").length
  const corpusHealthScore = docs.length === 0 ? 0 : Math.round((readyDatasetsCount / docs.length) * 100)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dataset Knowledge Base Ingestion</h1>
        <p className="text-sm text-muted dark:text-slate-400 mt-1">
          Source-aware ingestion for multi-file datasets, folders, and ZIP archives (PDF, Excel, CSV, DOCX, TXT).
        </p>
      </div>

      <InvestigationJourney current="knowledge-base" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Upload Workspace */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-white p-5 dark:bg-slate-900 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Domain Selector */}
            <div className="flex flex-wrap gap-2">
              {(["enterprise", "legal", "healthcare"] as UploadDomain[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDomain(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide border transition-colors ${
                    domain === d
                      ? "bg-accent text-white border-accent shadow-sm"
                      : "border-border text-slate-600 dark:border-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {d} Domain
                </button>
              ))}
            </div>

            {/* Ingestion Mode Tabs */}
            <div className="flex rounded-lg border border-border dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800 text-xs font-medium">
              <button
                type="button"
                onClick={() => setUploadTab("files")}
                className={`px-3 py-1 rounded-md transition-all ${
                  uploadTab === "files"
                    ? "bg-white dark:bg-slate-900 text-accent font-semibold shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                1. Upload Files
              </button>
              <button
                type="button"
                onClick={() => setUploadTab("folder")}
                className={`px-3 py-1 rounded-md transition-all ${
                  uploadTab === "folder"
                    ? "bg-white dark:bg-slate-900 text-accent font-semibold shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                2. Upload Folder / Dataset
              </button>
              <button
                type="button"
                onClick={() => setUploadTab("zip")}
                className={`px-3 py-1 rounded-md transition-all ${
                  uploadTab === "zip"
                    ? "bg-white dark:bg-slate-900 text-accent font-semibold shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                3. Upload ZIP
              </button>
            </div>
          </div>

          {/* Dataset Name Override Input */}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Logical Dataset Name (e.g. Legal_Compendium, Hospital_Records, Kaggle_HR_Data)"
              value={datasetNameInput}
              onChange={(e) => setDatasetNameInput(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-border dark:bg-slate-800 dark:border-slate-600 focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* TAB 1: Multiple Files */}
          {uploadTab === "files" && (
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border dark:border-slate-600 px-6 py-9 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <span className="text-sm font-semibold">Select or Drop Multiple Files</span>
              <span className="text-xs text-muted text-center max-w-md">
                Supported: <strong>.pdf, .xlsx, .xls, .csv, .docx, .txt</strong>. Multiple files are automatically grouped as one dataset.
              </span>
              <input
                ref={filesInputRef}
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.csv,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  if (e.target.files) void handleFilesSelected(e.target.files)
                  e.target.value = ""
                }}
              />
            </label>
          )}

          {/* TAB 2: Real Folder / Dataset Selection */}
          {uploadTab === "folder" && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-accent/40 bg-accent/5 dark:border-accent/30 dark:bg-accent/5 px-6 py-9">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <span className="text-sm font-semibold">Native Browser Folder / Dataset Ingestion</span>
              <span className="text-xs text-muted text-center max-w-md">
                Select an entire directory from your local drive. The folder name becomes the Dataset, and all supported child files are recursively discovered and indexed.
              </span>
              <button
                type="button"
                disabled={uploading}
                onClick={() => folderInputRef.current?.click()}
                className="mt-2 px-4 py-2 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50"
              >
                {uploading ? "Ingesting Folder…" : "Select Folder from Computer"}
              </button>
              <input
                ref={folderInputRef}
                type="file"
                // @ts-expect-error webkitdirectory is standard for folder picker
                webkitdirectory="true"
                directory="true"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const files = e.target.files
                  if (files && files.length > 0) {
                    const firstRel = (files[0] as any).webkitRelativePath || ""
                    const folderName = firstRel.split("/")[0] || ""
                    void handleFilesSelected(files, datasetNameInput || folderName)
                  }
                  e.target.value = ""
                }}
              />
            </div>
          )}

          {/* TAB 3: ZIP Archive Ingestion */}
          {uploadTab === "zip" && (
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border dark:border-slate-600 px-6 py-9 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <span className="text-sm font-semibold">Select ZIP Dataset Archive (.zip)</span>
              <span className="text-xs text-muted text-center max-w-md">
                Automatic safe extraction with path-traversal protection. Ignores junk binaries, discovers all PDFs, Excel sheets, and CSVs, and builds a unified index.
              </span>
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  if (e.target.files) void handleFilesSelected(e.target.files)
                  e.target.value = ""
                }}
              />
            </label>
          )}

          {uploading && (
            <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="text-xs text-accent font-medium">
                Ingesting dataset: Discovering files → Extracting sheets/pages → Building continuation schema index → Persistent embedding…
              </p>
            </div>
          )}

          {error && <p className="text-xs text-danger font-medium bg-red-50 dark:bg-red-950/40 p-3 rounded-lg border border-red-200 dark:border-red-900">{error}</p>}

          {/* Last Indexed Banner */}
          {lastDataset && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 dark:bg-green-950/30 dark:border-green-800">
                <div>
                  <p className="text-sm font-semibold text-green-900 dark:text-green-300">
                    Dataset &quot;{lastDataset.datasetName || lastDataset.title}&quot; Successfully Indexed (Status: {lastDataset.status || "READY"})
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                    {lastDataset.sourceFiles?.length || 1} file(s) · {lastDataset.chunks} searchable chunks indexed. Full provenance preserved.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/verify")}
                  className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold shrink-0 shadow-sm"
                >
                  Verify in Console →
                </button>
              </div>

              {lastDataset.datasetHealth && (
                <DatasetHealthCard health={lastDataset.datasetHealth} />
              )}
            </div>
          )}
        </div>

        {/* Right Column: Real Corpus Health Summary */}
        <div className="rounded-xl border border-border bg-white p-5 dark:bg-slate-900 dark:border-slate-700 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono uppercase tracking-widest text-muted">Corpus Health</p>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
              {readyDatasetsCount} / {docs.length} READY
            </span>
          </div>

          <div>
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {corpusHealthScore}%
            </p>
            <p className="text-xs text-muted mt-0.5">Real Ingestion Reliability Score</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border dark:border-slate-800">
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-[10px] text-muted uppercase block">Total Datasets</span>
              <span className="font-semibold text-sm">{totalDatasets || docs.length}</span>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-[10px] text-muted uppercase block">Source Files</span>
              <span className="font-semibold text-sm">{totalFilesCount}</span>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-[10px] text-muted uppercase block">PDF Pages</span>
              <span className="font-semibold text-sm">{totalPdfPages}</span>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-[10px] text-muted uppercase block">Excel Sheets</span>
              <span className="font-semibold text-sm">{totalSheets}</span>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-[10px] text-muted uppercase block">Spreadsheet Rows</span>
              <span className="font-semibold text-sm">{totalRows.toLocaleString()}</span>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-[10px] text-muted uppercase block">Indexed Chunks</span>
              <span className="font-semibold text-sm text-accent">{totalChunks.toLocaleString()}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-border dark:border-slate-800 space-y-1 text-xs text-muted">
            <p className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Enterprise Knowledge: HR / Policy / Finance</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Legal Compendium: Acts / Amendments / Case Law</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span>Hospital Healthcare: Clinical / Protocols / Drug Data</span>
            </p>
          </div>
        </div>
      </div>

      {/* Dataset & Document Hierarchy List */}
      <div className="rounded-xl border border-border bg-white dark:bg-slate-900 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-border dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted">Indexed Datasets &amp; Knowledge Sources</p>
            <p className="text-xs text-muted mt-0.5">Click any dataset to expand individual source files, schemas, and continuation links</p>
          </div>
          <span className="text-xs font-medium text-slate-500">{docs.length} Knowledge Bases</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted bg-slate-50 dark:bg-slate-800/60 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Knowledge Base / Dataset</th>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Sources</th>
                <th className="px-4 py-3">Chunks</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-slate-700">
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-muted text-sm">
                    No datasets indexed yet. Use the upload options above to ingest files, folders, or ZIP archives.
                  </td>
                </tr>
              ) : (
                docs.map((d) => {
                  const isExpanded = expandedId === d.id
                  const sourceFiles = d.sourceFiles || []
                  const status = d.status || d.indexedStatus || "READY"
                  const health = d.datasetHealth
                  const healthScore = health ? health.healthScorePercent : 100

                  return (
                    <Fragment key={d.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : d.id)}
                        className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted">{isExpanded ? "▼" : "▶"}</span>
                            <div>
                              <p className="font-semibold text-foreground flex items-center gap-2">
                                {d.datasetName || d.title}
                                {d.version && d.version > 1 && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                    v{d.version}
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-muted">
                                {d.isDataset ? "Multi-file Dataset" : d.filename} · {new Date(d.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 capitalize text-xs font-medium">
                          {d.firewallDomain || toFirewallDomain(d.domain as any)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="font-semibold">{sourceFiles.length > 0 ? `${sourceFiles.length} files` : "1 file"}</span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono">
                          {d.chunks} chunks
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <StatusBadge status={status} />
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span
                            className={
                              healthScore >= 80
                                ? "text-safe font-semibold"
                                : healthScore >= 50
                                  ? "text-amber-600 font-semibold"
                                  : "text-danger font-semibold"
                            }
                          >
                            {healthScore}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            {status !== "READY" && status !== "indexed" && (
                              <button
                                type="button"
                                disabled={retryingId === d.id}
                                onClick={() => handleRetryIndexing(d.id)}
                                className="px-2 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 text-[11px] font-semibold"
                              >
                                {retryingId === d.id ? "Indexing…" : "Retry Indexing"}
                              </button>
                            )}
                            {health && (
                              <button
                                type="button"
                                onClick={() => setHealthModalDoc(d)}
                                className="px-2 py-1 rounded border border-border text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                              >
                                Health
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleDelete(d.id, e)}
                              className="px-2 py-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-[11px] font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Source Files Details */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 dark:bg-slate-800/40 border-t border-border dark:border-slate-700">
                          <td colSpan={7} className="px-8 py-4 space-y-3">
                            {d.relationshipSummary && d.relationshipSummary.length > 0 && (
                              <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-xs space-y-1">
                                <p className="font-semibold text-blue-900 dark:text-blue-200">
                                  Continuation &amp; Schema Relationship Detection:
                                </p>
                                {d.relationshipSummary.map((rel, idx) => (
                                  <p key={idx} className="text-blue-800 dark:text-blue-300">
                                    · {rel}
                                  </p>
                                ))}
                              </div>
                            )}

                            <div>
                              <p className="text-xs font-mono uppercase tracking-widest text-muted mb-2">
                                Individual Source Files in this Dataset ({sourceFiles.length || 1}):
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {sourceFiles.length > 0 ? (
                                  sourceFiles.map((sf) => (
                                    <div
                                      key={sf.id}
                                      className="p-3 rounded-lg border border-border bg-white dark:bg-slate-900 text-xs space-y-1"
                                    >
                                      <div className="flex items-center justify-between">
                                        <p className="font-semibold text-foreground truncate max-w-[200px]" title={sf.filename}>
                                          {sf.filename}
                                        </p>
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-100 dark:bg-slate-800">
                                          {sf.fileType}
                                        </span>
                                      </div>
                                      <div className="text-muted flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                                        {sf.pages ? <span>{sf.pages} page(s)</span> : null}
                                        {sf.sheets ? <span>{sf.sheets.length} sheet(s)</span> : null}
                                        {sf.totalRows ? <span>{sf.totalRows} rows</span> : null}
                                        <span>{sf.chunks} chunks</span>
                                      </div>
                                      {sf.schema?.columns && sf.schema.columns.length > 0 && (
                                        <p className="text-[10px] text-muted truncate" title={sf.schema.columns.join(", ")}>
                                          Columns: {sf.schema.columns.slice(0, 4).join(", ")}{sf.schema.columns.length > 4 ? ` +${sf.schema.columns.length - 4} more` : ""}
                                        </p>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-3 rounded-lg border border-border bg-white dark:bg-slate-900 text-xs space-y-1">
                                    <p className="font-semibold">{d.filename}</p>
                                    <p className="text-muted">{d.chunks} chunks · {d.pages || 1} page(s)</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dataset Health Detail Modal */}
      {healthModalDoc && healthModalDoc.datasetHealth && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-border dark:border-slate-700 max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-semibold text-base">Dataset Health Report</h3>
                <p className="text-xs text-muted">{healthModalDoc.datasetName || healthModalDoc.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setHealthModalDoc(null)}
                className="text-muted hover:text-foreground text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <DatasetHealthCard health={healthModalDoc.datasetHealth} />

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setHealthModalDoc(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "READY":
    case "indexed":
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300">
          READY
        </span>
      )
    case "PARTIALLY_READY":
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          PARTIAL
        </span>
      )
    case "INDEXING":
    case "PROCESSING":
    case "UPLOADING":
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 animate-pulse">
          {status}
        </span>
      )
    case "FAILED":
    default:
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
          FAILED
        </span>
      )
  }
}

function DatasetHealthCard({ health }: { health: RealDatasetHealth }) {
  return (
    <div className="rounded-lg border border-border dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono uppercase tracking-widest text-muted">Ingestion Health Metrics</p>
        <span className="text-sm font-bold text-accent">{health.healthScorePercent}% Health</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="p-2 bg-white dark:bg-slate-900 rounded border border-border dark:border-slate-800">
          <span className="text-[10px] text-muted uppercase block">Files Processed</span>
          <span className="font-semibold">{health.filesProcessed} / {health.filesDiscovered}</span>
        </div>
        <div className="p-2 bg-white dark:bg-slate-900 rounded border border-border dark:border-slate-800">
          <span className="text-[10px] text-muted uppercase block">PDF Pages</span>
          <span className="font-semibold">{health.pdfPages}</span>
        </div>
        <div className="p-2 bg-white dark:bg-slate-900 rounded border border-border dark:border-slate-800">
          <span className="text-[10px] text-muted uppercase block">Excel Sheets</span>
          <span className="font-semibold">{health.excelSheets}</span>
        </div>
        <div className="p-2 bg-white dark:bg-slate-900 rounded border border-border dark:border-slate-800">
          <span className="text-[10px] text-muted uppercase block">Rows Processed</span>
          <span className="font-semibold">{health.totalRows || health.csvRows}</span>
        </div>
        <div className="p-2 bg-white dark:bg-slate-900 rounded border border-border dark:border-slate-800">
          <span className="text-[10px] text-muted uppercase block">Chunks Indexed</span>
          <span className="font-semibold">{health.chunksIndexed} / {health.chunksCreated}</span>
        </div>
        <div className="p-2 bg-white dark:bg-slate-900 rounded border border-border dark:border-slate-800">
          <span className="text-[10px] text-muted uppercase block">Embedding Coverage</span>
          <span className="font-semibold">{health.embeddingCoveragePercent}%</span>
        </div>
        <div className="p-2 bg-white dark:bg-slate-900 rounded border border-border dark:border-slate-800">
          <span className="text-[10px] text-muted uppercase block">Duplicate Files</span>
          <span className="font-semibold">{health.duplicateFiles.length}</span>
        </div>
        <div className="p-2 bg-white dark:bg-slate-900 rounded border border-border dark:border-slate-800">
          <span className="text-[10px] text-muted uppercase block">Extraction Status</span>
          <span className="font-semibold">{health.status}</span>
        </div>
      </div>

      {health.extractionErrors && health.extractionErrors.length > 0 && (
        <div className="p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded text-xs space-y-0.5 text-red-800 dark:text-red-300">
          <p className="font-semibold">Extraction Issues:</p>
          {health.extractionErrors.slice(0, 3).map((err, i) => (
            <p key={i}>· {err}</p>
          ))}
        </div>
      )}
    </div>
  )
}
