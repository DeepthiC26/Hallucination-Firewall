"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import FloatingChatbot from "@/components/FloatingChatbot"
import KnowledgeBaseSidebar from "@/components/KnowledgeBaseSidebar"
import DomainWebsite from "@/components/DomainWebsite"
import type { FirewallDomain } from "@/types"

export default function Dashboard() {
  const [selectedDomain, setSelectedDomain] = useState<FirewallDomain>("legal")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [kbSeedStatus, setKbSeedStatus] = useState<Record<string, boolean>>({})
  const [docsVersion, setDocsVersion] = useState(0)
  const [kbStats, setKbStats] = useState({ docs: 0, chunks: 0, status: "EMPTY" })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const domain = params.get("domain") as FirewallDomain
    const stored = localStorage.getItem("hf_domain") as FirewallDomain
    if (domain && ["healthcare", "legal", "enterprise"].includes(domain)) {
      setSelectedDomain(domain)
      localStorage.setItem("hf_domain", domain)
    } else if (stored && ["healthcare", "legal", "enterprise"].includes(stored)) {
      setSelectedDomain(stored)
    }
  }, [])

  const handleDomainChange = (d: FirewallDomain) => {
    setSelectedDomain(d)
    localStorage.setItem("hf_domain", d)
    // Update URL without reload
    const url = new URL(window.location.href)
    url.searchParams.set("domain", d)
    window.history.pushState({}, "", url)
  }

  const [availableDocs, setAvailableDocs] = useState<any[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string>("")

  // Fetch KB stats and available docs
  useEffect(() => {
    fetch("/api/docs")
      .then((r) => r.json())
      .then((docs: any[]) => {
        const mapDomain = (d: string) => {
          if (d === "legal") return "legal"
          if (d === "healthcare") return "healthcare"
          return "enterprise"
        }
        const domainDocs = docs.filter(d => mapDomain(d.domain) === selectedDomain)
        setAvailableDocs(domainDocs)
        const totalDocs = domainDocs.length
        const totalChunks = domainDocs.reduce((acc, d) => acc + (d.chunks || d.vectorIds?.length || 0), 0)
        
        let status = "EMPTY"
        if (totalChunks > 0) status = "READY"
        else if (totalDocs > 0) status = "INDEXING"
        
        setKbStats({ docs: totalDocs, chunks: totalChunks, status })

        // Auto-select first doc/dataset if not set or not in current domain
        if (domainDocs.length > 0 && (!selectedDocId || !domainDocs.some(d => d.id === selectedDocId))) {
          setSelectedDocId(domainDocs[0].id)
        }
      })
      .catch(() => null)
  }, [selectedDomain, docsVersion])

  // Auto-seed KB on load
  useEffect(() => {
    fetch("/api/seed-kb")
      .then((r) => r.json())
      .then((data: Record<string, { seeded: boolean }>) => {
        const seeded: Record<string, boolean> = {}
        for (const [d, v] of Object.entries(data)) {
          seeded[d] = v.seeded
        }
        setKbSeedStatus(seeded)

        // Seed any domain that is not yet seeded
        const toSeed = Object.entries(seeded)
          .filter(([, v]) => !v)
          .map(([d]) => d)

        if (toSeed.length > 0) {
          fetch("/api/seed-kb", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domain: "all" }),
          }).catch(() => null)
        }
      })
      .catch(() => null)
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Faux Website Content */}
      <div className="flex-1 relative flex flex-col overflow-hidden">
        <DomainWebsite selectedDomain={selectedDomain} onDomainChange={handleDomainChange} />
        {/* The Floating Chatbot */}
        <FloatingChatbot
          selectedDomain={selectedDomain}
          kbReady={kbStats.status === "READY"}
          activeDocId={selectedDocId}
          onActiveDocChange={setSelectedDocId}
        />
      </div>

      {/* Sticky KB Status Bar */}
      <div className="bg-slate-900 border-t border-slate-700 text-slate-300 p-2 px-6 flex justify-between items-center text-xs shrink-0 z-50">
        <div className="flex gap-6 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <span className="uppercase tracking-wider font-bold text-slate-500">KB Status:</span>
            {kbStats.status === "READY" ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span> READY</span>
            ) : kbStats.status === "EMPTY" ? (
              <span className="text-red-400 font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span> EMPTY</span>
            ) : (
              <span className="text-yellow-400 font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span> INDEXING</span>
            )}
          </div>
          <div className="hidden sm:flex gap-4 border-l border-slate-700 pl-4">
            <div><span className="text-slate-500">Collection:</span> {selectedDomain}_kb</div>
            <div><span className="text-slate-500">Documents:</span> <span className="font-mono text-slate-200">{kbStats.docs}</span></div>
            <div><span className="text-slate-500">Vectors (Chunks):</span> <span className="font-mono text-slate-200">{kbStats.chunks}</span></div>
          </div>
          <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
            <span className="uppercase tracking-wider font-bold text-slate-400">Active Dataset/Doc:</span>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 outline-none max-w-[220px] truncate"
            >
              <option value="">-- None (Deselected) --</option>
              {availableDocs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.datasetName || d.title || d.filename} ({d.chunks || d.vectorIds?.length || 0} chunks)
                </option>
              ))}
            </select>
          </div>
        </div>
        <button 
          onClick={() => setSidebarOpen(true)} 
          className="bg-slate-800 border border-slate-600 hover:bg-slate-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors"
        >
          Manage Knowledge Base
        </button>
      </div>

      {/* Knowledge Base Sidebar */}
      <KnowledgeBaseSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onDocsChange={() => {
          setSidebarOpen(false)
          setDocsVersion((v) => v + 1)
        }}
      />
    </div>
  )
}
