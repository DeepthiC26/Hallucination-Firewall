"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import type { FirewallDomain } from "@/types"
import { motion, AnimatePresence } from "framer-motion"
import { getAssistantBubbleText } from "@/lib/chat-response-helper"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  decision?: string
  confidenceScore?: number
  firewallEnabled: boolean
  timestamp: Date
  rawLlmResponse?: string
  queryId?: string
  details?: any // For forensic view
}

interface DomainConfig {
  label: string
  icon: string
  color: string
  description: string
  suggestions: string[]
}

const DOMAIN_CONFIGS: Record<FirewallDomain, DomainConfig> = {
  healthcare: {
    label: "Hospital Assistant",
    icon: "🏥",
    color: "bg-blue-600",
    description: "I can help you find information about services, policies, facilities, and other hospital information.",
    suggestions: [
      "How many ICU beds are available?",
      "What are the visiting hours?",
      "Tell me about the facilities.",
      "How do I book a specialist appointment?",
    ],
  },
  legal: {
    label: "Legal Assistant",
    icon: "⚖️",
    color: "bg-purple-600",
    description: "I can help you find information about contracts, acts, sections, and legal policies.",
    suggestions: [
      "Which article of the Indian Constitution protects life and personal liberty?",
      "What is the notice period in the contract?",
      "What are the payment terms?",
      "What is the limitation of liability?",
    ],
  },
  enterprise: {
    label: "Enterprise Assistant",
    icon: "🏢",
    color: "bg-emerald-600",
    description: "I can help you find information about HR policies, employee services, IT support, and benefits.",
    suggestions: [
      "What is the annual leave entitlement?",
      "What was the Q4 2024 revenue?",
      "What is the work from home policy?",
      "What is the expense reimbursement limit?",
    ],
  },
}

interface Props {
  selectedDomain: FirewallDomain
  kbReady?: boolean
  activeDocId?: string
  onActiveDocChange?: (docId: string) => void
}

export default function FloatingChatbot({
  selectedDomain,
  kbReady = false,
  activeDocId,
  onActiveDocChange,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [firewallEnabled, setFirewallEnabled] = useState(true)
  const [selectedProvider, setSelectedProvider] = useState("")
  const [selectedModel, setSelectedModel] = useState("")
  const [providers, setProviders] = useState<{ id: string; name: string; models: { id: string; name: string }[] }[]>([])

  // Available docs/datasets for active domain
  const [availableDocs, setAvailableDocs] = useState<any[]>([])
  const [localDocId, setLocalDocId] = useState<string>("")
  const currentDocId = activeDocId !== undefined && activeDocId !== "" ? activeDocId : localDocId

  // Store the last query and raw response to allow deterministic comparison testing
  const [lastQuery, setLastQuery] = useState("")
  const [lastRawResponse, setLastRawResponse] = useState("")
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID())

  // Exact raw response cache keyed by: domain + provider + model + docId + normalized question
  const rawResponseCache = useRef<Map<string, string>>(new Map())

  // Reviewer demo tools & raw injection
  const [showReviewerTools, setShowReviewerTools] = useState(false)
  const [injectedRaw, setInjectedRaw] = useState("")

  const [expandedDetailsId, setExpandedDetailsId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const config = DOMAIN_CONFIGS[selectedDomain]

  const buildReuseKey = (domain: string, prov: string, mod: string, doc: string, q: string) => {
    return `${(domain || "").toLowerCase()}:::${(prov || "").toLowerCase()}:::${(mod || "").toLowerCase()}:::${(doc || "").toLowerCase()}:::${q.trim().toLowerCase()}`
  }

  useEffect(() => {
    async function loadData() {
      try {
        const [provRes, confRes, docsRes] = await Promise.all([
          fetch("/api/llm/providers"),
          fetch("/api/llm/config"),
          fetch("/api/docs"),
        ])
        if (provRes.ok && confRes.ok) {
          const provData = await provRes.json()
          const confData = await confRes.json()
          setProviders(provData)
          setSelectedProvider(confData.defaultProvider || "")
          setSelectedModel(confData.defaultModel || "")
        }
        if (docsRes.ok) {
          const allDocs = await docsRes.json()
          const mapDomain = (d: string) => {
            if (d === "legal") return "legal"
            if (d === "healthcare") return "healthcare"
            return "enterprise"
          }
          const filtered = allDocs.filter((d: any) => mapDomain(d.domain) === selectedDomain)
          setAvailableDocs(filtered)
          if (filtered.length > 0 && !currentDocId) {
            setLocalDocId(filtered[0].id)
            onActiveDocChange?.(filtered[0].id)
          }
        }
      } catch (err) {
        console.error(err)
      }
    }
    loadData()
  }, [selectedDomain])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, expandedDetailsId, isOpen])

  // Reset chat when domain changes
  useEffect(() => {
    setMessages([])
    setLastQuery("")
    setLastRawResponse("")
    setExpandedDetailsId(null)
  }, [selectedDomain])

  const startNewConversation = () => {
    setMessages([])
    setLastQuery("")
    setLastRawResponse("")
    setExpandedDetailsId(null)
    setConversationId(crypto.randomUUID())
  }

  const sendMessage = useCallback(
    async (
      queryText?: string,
      options?: {
        forcedRaw?: string
        isCompare?: boolean
        forcedFirewall?: boolean
      }
    ) => {
      const text = (queryText ?? input).trim()
      if (!text || isLoading) return

      const effectiveFirewall =
        options?.forcedFirewall !== undefined ? options.forcedFirewall : firewallEnabled

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        firewallEnabled: effectiveFirewall,
        timestamp: new Date(),
      }

      if (effectiveFirewall && !selectedDomain) return

      // Constraint: Strictly prevent passing if kbReady is false and firewallEnabled is true
      if (effectiveFirewall && !kbReady) {
        const warningMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "⚠️ The Hallucination Firewall cannot verify answers because the Knowledge Base for this domain is empty or still indexing. Please upload seed documents in the Knowledge Base sidebar before asking questions, or disable the Firewall to talk to the raw LLM.",
          firewallEnabled: effectiveFirewall,
          timestamp: new Date(),
          decision: "block",
        }
        setMessages((prev) => [...prev, userMsg, warningMsg])
        setInput("")
        return
      }

      // Check if dataset is selected when Firewall is ON
      if (effectiveFirewall && !currentDocId) {
        const noKbMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Select a Knowledge Base document/dataset first to enable firewall verification.",
          firewallEnabled: effectiveFirewall,
          timestamp: new Date(),
          decision: "block",
        }
        setMessages((prev) => [...prev, userMsg, noKbMsg])
        setInput("")
        return
      }

      setMessages((prev) => [...prev, userMsg])
      setInput("")
      setIsLoading(true)

      const placeholderId = crypto.randomUUID()
      const placeholder: Message = {
        id: placeholderId,
        role: "assistant",
        content: "",
        firewallEnabled: effectiveFirewall,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, placeholder])

      let finalText = ""
      let displayedResponse = ""
      let decision = ""
      let confidence = 0
      let rawLlm = ""
      let canonicalFinal = ""
      let canonicalRaw = ""
      let queryId = ""
      let gatheredDetails: any = { claims: [], evidence: [] }

      // Section A: Reuse key = domain + provider + model + knowledgeBaseId/docId + normalized question
      const cacheKey = buildReuseKey(
        selectedDomain,
        selectedProvider,
        selectedModel,
        currentDocId,
        text
      )

      let payloadRawLlm: string | undefined = undefined
      if (options?.isCompare) {
        // Compare ON/OFF MUST send body.rawLlmResponse = that captured string
        payloadRawLlm =
          options.forcedRaw || rawResponseCache.current.get(cacheKey) || lastRawResponse || undefined
      } else if (injectedRaw.trim()) {
        // Reviewer override injection
        payloadRawLlm = injectedRaw.trim()
      } else {
        // Normal send: allow fresh generate, do NOT force cached raw unless compare was clicked
        payloadRawLlm = undefined
      }

      try {
        const res = await fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            domain: selectedDomain,
            firewallEnabled: effectiveFirewall,
            rawLlmResponse: payloadRawLlm,
            provider: selectedProvider,
            model: selectedModel,
            docId: currentDocId || undefined,
            datasetId: currentDocId || undefined,
            conversationId,
          }),
        })

        if (!res.body) throw new Error("No stream")
        const reader = res.body.getReader()
        const decoder = new TextDecoder()

        let currentStatusText = effectiveFirewall
          ? "🛡 Verifying response..."
          : "AI is typing..."
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split("\n\n")
          buffer = parts.pop() || ""

          for (const part of parts) {
            const trimmedPart = part.trim()
            if (!trimmedPart) continue
            const lines = trimmedPart.split("\n")
            for (const line of lines) {
              const trimmedLine = line.trim()
              if (!trimmedLine.startsWith("data: ")) continue
              const jsonStr = trimmedLine.slice(6).trim()
              if (!jsonStr) continue
              try {
                const event = JSON.parse(jsonStr)

                if (event.queryId) {
                  queryId = event.queryId
                }

                // Map backend stages to UI loading states
                if (effectiveFirewall) {
                  if (event.stage === "llm_response") currentStatusText = "🛡 Verifying response..."
                  if (event.stage === "claim_extraction") currentStatusText = "🛡 Extracting claims..."
                  if (event.stage === "evidence_matching") {
                    currentStatusText = "🛡 Retrieving evidence..."
                    if (event.data?.perClaimEvidence) {
                      gatheredDetails.evidence = event.data.perClaimEvidence
                    }
                  }
                  if (event.stage === "decision") currentStatusText = "🛡 Finalizing decision..."
                } else {
                  if (event.stage === "llm_response" || event.stage === "received")
                    currentStatusText = "AI is typing..."
                }

                // Update placeholder with current status
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === placeholderId ? { ...m, content: currentStatusText } : m
                  )
                )

                if (event.stage === "llm_response" && event.data?.text) {
                  rawLlm = event.data.text as string
                }

                if (event.stage === "claim_extraction" && event.data?.claims) {
                  gatheredDetails.claims = event.data.claims
                }

                if (event.stage === "decision" && event.data?.decision) {
                  decision = event.data.decision as string
                }

                if (event.stage === "final_response" && event.data) {
                  if (event.data.displayedResponse) {
                    displayedResponse = event.data.displayedResponse as string
                  }
                  if (event.data.text) {
                    finalText = event.data.text as string
                  }
                  if (event.data.decision) {
                    decision = event.data.decision as string
                  }
                  if (event.data.confidenceScore != null) {
                    confidence = event.data.confidenceScore as number
                  }
                  if (event.data.rawLlmResponse) {
                    rawLlm = event.data.rawLlmResponse as string
                  }
                  if (event.data.canonicalRecord) {
                    if (event.data.canonicalRecord.finalDeliveredResponse) {
                      canonicalFinal = event.data.canonicalRecord.finalDeliveredResponse
                    }
                    if (event.data.canonicalRecord.rawLlmResponse) {
                      canonicalRaw = event.data.canonicalRecord.rawLlmResponse
                    }
                  }
                }
              } catch (parseErr) {
                console.warn("Failed to parse SSE line in FloatingChatbot:", parseErr)
              }
            }
          }
        }

        // Flush any trailing event in buffer
        if (buffer.trim()) {
          const lines = buffer.trim().split("\n")
          for (const line of lines) {
            const trimmedLine = line.trim()
            if (trimmedLine.startsWith("data: ")) {
              try {
                const event = JSON.parse(trimmedLine.slice(6).trim())
                if (event.queryId) queryId = event.queryId
                if (event.stage === "final_response" && event.data) {
                  if (event.data.displayedResponse)
                    displayedResponse = event.data.displayedResponse as string
                  if (event.data.text) finalText = event.data.text as string
                  if (event.data.decision) decision = event.data.decision as string
                  if (event.data.confidenceScore != null)
                    confidence = event.data.confidenceScore as number
                  if (event.data.rawLlmResponse) rawLlm = event.data.rawLlmResponse as string
                  if (event.data.canonicalRecord) {
                    if (event.data.canonicalRecord.finalDeliveredResponse)
                      canonicalFinal = event.data.canonicalRecord.finalDeliveredResponse
                    if (event.data.canonicalRecord.rawLlmResponse)
                      canonicalRaw = event.data.canonicalRecord.rawLlmResponse
                  }
                }
              } catch {}
            }
          }
        }
      } catch (err) {
        finalText = `Error: ${err instanceof Error ? err.message : "Request failed"}`
        decision = "error"
      }

      setLastQuery(text)
      const recordedRaw = rawLlm || canonicalRaw || payloadRawLlm || ""
      if (recordedRaw) {
        setLastRawResponse(recordedRaw)
        rawResponseCache.current.set(cacheKey, recordedRaw)
      }

      const bubbleContent = getAssistantBubbleText({
        firewallEnabled: effectiveFirewall,
        decision,
        finalText: displayedResponse || finalText,
        rawLlmText: recordedRaw,
        canonicalFinal,
        canonicalRaw,
      })

      const finalDecision = effectiveFirewall ? decision || "unverified" : "bypass"

      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                content: bubbleContent,
                decision: finalDecision,
                confidenceScore: confidence,
                rawLlmResponse: recordedRaw,
                queryId: queryId,
                details: gatheredDetails,
              }
            : m
        )
      )
      setIsLoading(false)
    },
    [
      input,
      isLoading,
      firewallEnabled,
      selectedDomain,
      lastQuery,
      lastRawResponse,
      conversationId,
      selectedProvider,
      selectedModel,
      currentDocId,
      injectedRaw,
      kbReady,
    ]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const toggleDetails = (id: string) => {
    setExpandedDetailsId((prev) => (prev === id ? null : id))
  }

  const handleCompare = (msg: Message) => {
    const nextFirewall = !msg.firewallEnabled
    setFirewallEnabled(nextFirewall)
    const key = buildReuseKey(
      selectedDomain,
      selectedProvider,
      selectedModel,
      currentDocId,
      lastQuery
    )
    const rawToReuse =
      msg.rawLlmResponse || rawResponseCache.current.get(key) || lastRawResponse
    setTimeout(() => {
      sendMessage(lastQuery, {
        isCompare: true,
        forcedRaw: rawToReuse,
        forcedFirewall: nextFirewall,
      })
    }, 100)
  }

  const runPreset = (testNum: 1 | 2 | 3) => {
    if (testNum === 1) {
      // Test 1 — Correct Article 21 (PASS, ON=OFF)
      setInput("Which article of the Indian Constitution protects life and personal liberty?")
      setInjectedRaw(
        "Article 21 of the Constitution of India provides for the protection of life and personal liberty. No person shall be deprived of his life or personal liberty except according to procedure established by law."
      )
    } else if (testNum === 2) {
      // Test 2 — Forced Wrong Article 32 (REWRITE, ON≠OFF)
      setInput("Which article of the Indian Constitution protects life and personal liberty?")
      setInjectedRaw(
        "Article 32 guarantees the Right to Life and Personal Liberty in India."
      )
    } else if (testNum === 3) {
      // Test 3 — Unsupported Question (BLOCK, ON)
      setInput("What is the Quantum Flux Limitation Protocol under the Constitution of India?")
      setInjectedRaw(
        "Under the Quantum Flux Limitation Protocol, all temporal claims are restricted to 42 sub-cycles per fiscal year."
      )
    }
  }

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 h-14 rounded-full bg-slate-900 text-white shadow-xl hover:bg-slate-800 transition-colors flex items-center gap-3 px-6 z-50 group"
          >
            <span className="text-xl">{config.icon}</span>
            <span className="font-semibold font-sans tracking-wide">Ask AI Assistant</span>

            {/* Small tooltip indicating Firewall State */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-slate-900 px-3 py-1.5 rounded-lg shadow-md border border-slate-200 text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  firewallEnabled ? "bg-emerald-500" : "bg-red-500"
                }`}
              ></span>
              Firewall is {firewallEnabled ? "ON" : "OFF"}
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 w-[440px] h-[670px] max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden z-50 font-sans"
          >
            {/* Header */}
            <div className="bg-slate-900 text-white p-3.5 flex flex-col gap-2.5 shrink-0 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-lg relative">
                    {config.icon}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{config.label}</h3>
                    <p className="text-[10px] text-slate-300">
                      Domain: <span className="font-semibold uppercase text-emerald-400">{selectedDomain}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowReviewerTools(!showReviewerTools)}
                    className={`p-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                      showReviewerTools ? "bg-amber-500 text-slate-950 font-bold" : "bg-white/10 text-amber-300 hover:bg-white/20"
                    }`}
                    title="Reviewer & Demo Tools"
                  >
                    <span>🧪</span>
                    <span className="text-[10px]">Demo Tools</span>
                  </button>
                  <button
                    onClick={startNewConversation}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-300 hover:text-white"
                    title="New Conversation"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-300 hover:text-white"
                    title="Close"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Technical Controls (Provider, Model, Dataset & Firewall Switch) */}
              <div className="bg-slate-800/90 rounded-lg p-2 flex flex-col gap-1.5 border border-slate-700 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-[9px] uppercase text-slate-400 font-bold tracking-wider shrink-0">KB Doc:</span>
                    <select
                      value={currentDocId}
                      onChange={(e) => {
                        const val = e.target.value
                        setLocalDocId(val)
                        onActiveDocChange?.(val)
                      }}
                      className="bg-slate-700 text-white text-[10px] rounded px-1.5 py-0.5 border border-slate-600 outline-none w-full truncate"
                    >
                      <option value="">-- No Doc (Deselected) --</option>
                      {availableDocs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.datasetName || d.title || d.filename}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] uppercase text-slate-400 font-bold tracking-wider">Firewall</span>
                    <button
                      onClick={() => setFirewallEnabled(!firewallEnabled)}
                      className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                        firewallEnabled ? "bg-emerald-500" : "bg-slate-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${
                          firewallEnabled ? "translate-x-4" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-700/60 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] uppercase text-slate-400 font-bold tracking-wider">LLM:</span>
                    <select
                      value={selectedProvider}
                      onChange={(e) => {
                        setSelectedProvider(e.target.value)
                        const prov = providers.find((p) => p.id === e.target.value)
                        if (prov && prov.models.length > 0) setSelectedModel(prov.models[0].id)
                      }}
                      className="bg-slate-700 text-white text-[10px] rounded px-1 py-0.5 border border-slate-600 outline-none max-w-[95px] truncate"
                    >
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {providers.find((p) => p.id === selectedProvider) && (
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="bg-slate-700 text-white text-[10px] rounded px-1 py-0.5 border border-slate-600 outline-none max-w-[130px] truncate"
                    >
                      {providers
                        .find((p) => p.id === selectedProvider)
                        ?.models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* Reviewer / Demo Controls Drawer */}
            <AnimatePresence>
              {showReviewerTools && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-slate-850 bg-slate-900 border-b border-amber-500/40 p-3 text-xs space-y-2 z-20 shrink-0 text-slate-200"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-amber-400 text-[10px] uppercase tracking-wider flex items-center gap-1">
                      <span>🧪</span> Reviewer Demo Test Suite
                    </span>
                    <button
                      onClick={() => setShowReviewerTools(false)}
                      className="text-slate-400 hover:text-white text-[10px]"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => runPreset(1)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-750 rounded text-left border border-slate-700 hover:border-emerald-500 transition-colors"
                      title="Test 1: Correct Article 21 (PASS, ON=OFF)"
                    >
                      <div className="font-bold text-emerald-400 text-[10px]">Test 1 (PASS)</div>
                      <div className="text-[9px] text-slate-400 truncate">Art 21 Life/Liberty</div>
                    </button>
                    <button
                      onClick={() => runPreset(2)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-750 rounded text-left border border-slate-700 hover:border-amber-500 transition-colors"
                      title="Test 2: Wrong Article 32 (REWRITE, ON≠OFF)"
                    >
                      <div className="font-bold text-amber-400 text-[10px]">Test 2 (REWRITE)</div>
                      <div className="text-[9px] text-slate-400 truncate">Art 32 → Art 21</div>
                    </button>
                    <button
                      onClick={() => runPreset(3)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-750 rounded text-left border border-slate-700 hover:border-red-500 transition-colors"
                      title="Test 3: Unsupported Question (BLOCK, ON)"
                    >
                      <div className="font-bold text-red-400 text-[10px]">Test 3 (BLOCK)</div>
                      <div className="text-[9px] text-slate-400 truncate">Quantum Protocol</div>
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span>Injected Raw LLM Response (Optional Override):</span>
                      {injectedRaw && (
                        <button
                          onClick={() => setInjectedRaw("")}
                          className="text-amber-400 hover:underline text-[9px]"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <textarea
                      value={injectedRaw}
                      onChange={(e) => setInjectedRaw(e.target.value)}
                      placeholder="Type or paste arbitrary untrusted raw response to test ON vs OFF..."
                      rows={2}
                      className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-[10px] p-2 rounded resize-none outline-none focus:border-amber-400"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Firewall Banner */}
            <div
              className={`py-1.5 px-4 text-[10px] font-bold text-center uppercase tracking-widest shrink-0 border-b shadow-sm z-10 ${
                firewallEnabled
                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                  : "bg-red-50 text-red-700 border-red-100"
              }`}
            >
              {firewallEnabled
                ? "🟢 Firewall ON: Responses are verified against selected KB"
                : "🔴 Firewall OFF: Raw unverified AI responses delivered directly"}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm border border-slate-100 mb-3">
                    {config.icon}
                  </div>
                  <h4 className="font-bold text-slate-800 mb-1 text-sm">Hi! I'm your AI assistant.</h4>
                  <p className="text-xs text-slate-500 mb-5">{config.description}</p>
                  <div className="w-full space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-left px-1">
                      Suggested Questions
                    </p>
                    {config.suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(s)}
                        className="w-full text-left text-xs p-2.5 rounded-xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-sm transition-all text-slate-700"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${config.color} text-white shadow-sm text-xs`}
                    >
                      {config.icon}
                    </div>
                  )}

                  <div className="flex flex-col gap-1 max-w-[85%]">
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 text-xs shadow-sm ${
                        msg.role === "user"
                          ? "bg-slate-900 text-white rounded-tr-sm"
                          : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
                      }`}
                    >
                      {msg.role === "assistant" &&
                      isLoading &&
                      msg.id === messages[messages.length - 1]?.id ? (
                        <div className="flex items-center gap-2 text-slate-500 font-medium animate-pulse">
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-slate-500 animate-spin shrink-0" />
                          <span>
                            {msg.content ||
                              (msg.firewallEnabled ? "🛡 Verifying response..." : "AI is typing...")}
                          </span>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                      )}
                    </div>

                    {/* Verdict Badges & Actions */}
                    {msg.role === "assistant" && !isLoading && msg.content && (
                      <div className="flex flex-col gap-2 mt-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <DecisionBadge decision={msg.decision} firewallEnabled={msg.firewallEnabled} />

                          {msg.firewallEnabled && (
                            <button
                              onClick={() => toggleDetails(msg.id)}
                              className="text-[10px] text-blue-600 font-medium hover:underline flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full"
                            >
                              {expandedDetailsId === msg.id ? "Hide Firewall Details" : "View Firewall Details"}
                            </button>
                          )}
                          {msg.rawLlmResponse && msg.id === messages[messages.length - 1]?.id && (
                            <button
                              onClick={() => handleCompare(msg)}
                              className="text-[10px] text-purple-600 font-medium hover:underline flex items-center gap-1 bg-purple-50 px-2 py-0.5 rounded-full"
                            >
                              Compare Firewall {msg.firewallEnabled ? "OFF" : "ON"}
                            </button>
                          )}
                        </div>

                        {/* Inline Firewall Details Panel */}
                        {expandedDetailsId === msg.id && msg.firewallEnabled && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="bg-slate-900 rounded-xl p-3.5 mt-1 overflow-hidden border border-slate-800 shadow-inner"
                          >
                            <div className="flex justify-between items-center mb-2.5 border-b border-slate-700 pb-1.5">
                              <h4 className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">
                                Firewall Verification Details
                              </h4>
                              <a
                                href={`/dashboard/explainability?id=${msg.queryId || msg.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[9px] uppercase tracking-widest text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                              >
                                Open Full Investigation ↗
                              </a>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <span className="text-[9px] uppercase text-slate-500 font-bold block mb-1">
                                  Raw AI Response
                                </span>
                                <div className="text-[11px] text-slate-300 bg-slate-800/60 p-2 rounded border border-slate-700/50 whitespace-pre-wrap">
                                  {msg.rawLlmResponse || "No raw response recorded"}
                                </div>
                              </div>

                              <div>
                                <span className="text-[9px] uppercase text-slate-500 font-bold block mb-1">
                                  Claims Evaluated ({msg.details?.claims?.length || 0})
                                </span>
                                <div className="space-y-1.5">
                                  {msg.details?.claims?.map((claim: any, idx: number) => {
                                    const evidence = msg.details?.evidence?.find(
                                      (e: any) => e.claimId === claim.id
                                    )
                                    return (
                                      <div
                                        key={idx}
                                        className="text-[10px] bg-slate-800 rounded p-2 border border-slate-700"
                                      >
                                        <div className="flex gap-1.5 items-start mb-1">
                                          <span className="shrink-0 mt-0.5 text-slate-400">•</span>
                                          <span className="text-slate-200">{claim.claim}</span>
                                        </div>
                                        {evidence && (
                                          <div className="pl-2.5 mt-1.5 border-l-2 border-slate-600">
                                            <span className="text-[9px] text-emerald-400 font-bold block mb-0.5">
                                              Evidence Found:
                                            </span>
                                            <span className="text-slate-400 block line-clamp-2 italic text-[9px]">
                                              {evidence.bestExcerpt || "No supporting text retrieved"}
                                            </span>
                                            <span className="text-[8px] text-slate-500 mt-0.5 block">
                                              Source: {evidence.bestDocument || "Unknown"}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>

                              <div>
                                <span className="text-[9px] uppercase text-slate-500 font-bold block mb-1">
                                  Final Action
                                </span>
                                <div className="text-[10px] text-slate-200 flex items-center gap-2 bg-slate-800/60 p-2 rounded border border-slate-700/50">
                                  <DecisionBadge decision={msg.decision} firewallEnabled={msg.firewallEnabled} />
                                  <span>
                                    {msg.decision === "pass" && "Response fully verified against selected Knowledge Base."}
                                    {msg.decision === "rewrite" &&
                                      "Response contradicted Knowledge Base and was surgically corrected."}
                                    {msg.decision === "block" &&
                                      "Response could not be verified against the selected Knowledge Base and was blocked."}
                                  </span>
                                </div>
                              </div>

                              {msg.decision === "rewrite" && (
                                <div>
                                  <span className="text-[9px] uppercase text-amber-400 font-bold block mb-1">
                                    Corrected Delivered Text
                                  </span>
                                  <div className="text-[11px] text-emerald-300 bg-slate-800/60 p-2 rounded border border-emerald-900/50 whitespace-pre-wrap">
                                    {msg.content}
                                  </div>
                                </div>
                              )}

                              <div className="pt-1 flex justify-end">
                                <a
                                  href={`/dashboard/explainability?id=${msg.queryId}`}
                                  target="_blank"
                                  className="text-[9px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                                >
                                  Open Full Investigation ↗
                                </a>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-slate-100 shrink-0">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your question..."
                  rows={1}
                  disabled={isLoading}
                  className="flex-1 resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs bg-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:opacity-50"
                  style={{ maxHeight: "100px" }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="h-9 w-9 shrink-0 rounded-xl bg-slate-900 text-white flex items-center justify-center disabled:opacity-40 hover:bg-slate-800 transition-colors shadow-sm"
                >
                  {isLoading ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function DecisionBadge({ decision, firewallEnabled }: { decision?: string; firewallEnabled?: boolean }) {
  if (
    !firewallEnabled ||
    !decision ||
    decision === "bypass" ||
    decision === "unverified" ||
    decision === "unknown"
  ) {
    return (
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase bg-slate-100 text-slate-600 border-slate-200">
        Unverified
      </span>
    )
  }

  const cls =
    decision === "pass"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : decision === "rewrite"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-red-100 text-red-800 border-red-200"

  const label =
    decision === "pass" ? "✓ Verified" : decision === "rewrite" ? "✏ Corrected" : "✗ Blocked"

  return (
    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${cls}`}>
      {label}
    </span>
  )
}
