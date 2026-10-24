"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import type { FirewallDomain } from "@/types"
import { getAssistantBubbleText } from "@/lib/chat-response-helper"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  decision?: string
  confidenceScore?: number
  firewallEnabled: boolean
  timestamp: Date
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
    label: "Hospital / Healthcare",
    icon: "🏥",
    color: "bg-blue-600",
    description: "Verify clinical claims against hospital knowledge base",
    suggestions: [
      "How many ICU beds does the hospital have?",
      "What are the visiting hours for patients?",
      "What departments does the hospital have?",
      "How do I book a specialist appointment?",
      "What is the nurse-to-patient ratio?",
    ],
  },
  legal: {
    label: "Legal",
    icon: "⚖️",
    color: "bg-purple-600",
    description: "Verify legal claims against contract documents",
    suggestions: [
      "What is the notice period in the contract?",
      "What are the payment terms?",
      "Who owns the intellectual property?",
      "What is the governing law?",
      "What is the limitation of liability?",
    ],
  },
  enterprise: {
    label: "Enterprise",
    icon: "🏢",
    color: "bg-emerald-600",
    description: "Verify business claims against company knowledge base",
    suggestions: [
      "What is the annual leave entitlement?",
      "What was the Q4 2024 revenue?",
      "What is the work from home policy?",
      "What products does the company offer?",
      "What is the expense reimbursement limit?",
    ],
  },
}

interface Props {
  selectedDomain: FirewallDomain
  onDomainChange: (d: FirewallDomain) => void
  onQueryStart: (query: string, domain: FirewallDomain, firewallEnabled: boolean) => void
  onStreamEvent: (stage: string, data: Record<string, unknown>) => void
  onQueryComplete: (result: {
    queryId?: string
    query: string
    domain: FirewallDomain
    finalResponse: string
    decision: string
    confidenceScore: number
    rawLlmResponse: string
    firewallEnabled: boolean
  }) => void
}

export default function DomainChatbot({
  selectedDomain,
  onDomainChange,
  onQueryStart,
  onStreamEvent,
  onQueryComplete,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [firewallEnabled, setFirewallEnabled] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const config = DOMAIN_CONFIGS[selectedDomain]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = useCallback(
    async (queryText?: string) => {
      const text = (queryText ?? input).trim()
      if (!text || isLoading) return

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        firewallEnabled,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMsg])
      setInput("")
      setIsLoading(true)

      const placeholderId = crypto.randomUUID()
      const placeholder: Message = {
        id: placeholderId,
        role: "assistant",
        content: "",
        firewallEnabled,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, placeholder])

      onQueryStart(text, selectedDomain, firewallEnabled)

      let finalText = ""
      let displayedResponse = ""
      let decision = ""
      let confidence = 0
      let rawLlm = ""
      let canonicalFinal = ""
      let canonicalRaw = ""
      let queryId = ""

      try {
        const res = await fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            domain: selectedDomain,
            firewallEnabled,
          }),
        })

        if (!res.body) throw new Error("No stream")
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
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
                const event = JSON.parse(jsonStr) as { stage: string; data: Record<string, unknown>; queryId?: string }
                onStreamEvent(event.stage, event.data)

                if (event.data?.queryId || event.queryId) {
                  queryId = (event.data?.queryId || event.queryId) as string
                }
                if (event.stage === "llm_response" && event.data?.text) {
                  rawLlm = event.data.text as string
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
                  if (event.data.canonicalRecord && typeof event.data.canonicalRecord === "object") {
                    const cr = event.data.canonicalRecord as { finalDeliveredResponse?: string; rawLlmResponse?: string }
                    if (cr.finalDeliveredResponse) canonicalFinal = cr.finalDeliveredResponse
                    if (cr.rawLlmResponse) canonicalRaw = cr.rawLlmResponse
                  }
                }
              } catch (parseErr) {
                console.warn("Failed to parse SSE event in DomainChatbot:", parseErr)
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
                if (event.stage === "final_response" && event.data) {
                  if (event.data.displayedResponse) displayedResponse = event.data.displayedResponse as string
                  if (event.data.text) finalText = event.data.text as string
                  if (event.data.decision) decision = event.data.decision as string
                  if (event.data.confidenceScore != null) confidence = event.data.confidenceScore as number
                  if (event.data.rawLlmResponse) rawLlm = event.data.rawLlmResponse as string
                  if (event.data.canonicalRecord && typeof event.data.canonicalRecord === "object") {
                    const cr = event.data.canonicalRecord as { finalDeliveredResponse?: string; rawLlmResponse?: string }
                    if (cr.finalDeliveredResponse) canonicalFinal = cr.finalDeliveredResponse
                    if (cr.rawLlmResponse) canonicalRaw = cr.rawLlmResponse
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

      const bubbleContent = getAssistantBubbleText({
        firewallEnabled,
        decision,
        finalText: displayedResponse || finalText,
        rawLlmText: rawLlm,
        canonicalFinal,
        canonicalRaw,
      })

      const finalDecision = firewallEnabled ? (decision || "unverified") : "bypass"

      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? {
                ...m,
                content: bubbleContent,
                decision: finalDecision,
                confidenceScore: confidence,
              }
            : m
        )
      )
      setIsLoading(false)

      onQueryComplete({
        queryId,
        query: text,
        domain: selectedDomain,
        finalResponse: bubbleContent,
        decision: finalDecision,
        confidenceScore: confidence,
        rawLlmResponse: rawLlm || canonicalRaw,
        firewallEnabled,
      })
    },
    [input, isLoading, firewallEnabled, selectedDomain, onQueryStart, onStreamEvent, onQueryComplete]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-border dark:border-slate-700 overflow-hidden">
      {/* Domain Selector */}
      <div className="border-b border-border dark:border-slate-700 p-4">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 mb-2">Domain</p>
        <div className="flex gap-2">
          {(Object.entries(DOMAIN_CONFIGS) as [FirewallDomain, DomainConfig][]).map(([d, cfg]) => (
            <button
              key={d}
              onClick={() => onDomainChange(d)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedDomain === d
                  ? `${cfg.color} text-white shadow-sm`
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <span>{cfg.icon}</span>
              <span className="hidden sm:inline">{cfg.label}</span>
              <span className="sm:hidden">{cfg.label.split(" ")[0]}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">{config.description}</p>
          {/* Firewall Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${firewallEnabled ? "text-emerald-600" : "text-red-500"}`}>
              {firewallEnabled ? "🛡 Firewall ON" : "⚡ Firewall OFF"}
            </span>
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={firewallEnabled}
                onChange={(e) => setFirewallEnabled(e.target.checked)}
              />
              <div
                className={`w-9 h-5 rounded-full transition-colors ${firewallEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
                onClick={() => setFirewallEnabled((v) => !v)}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${firewallEnabled ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
            <span className="text-4xl">{config.icon}</span>
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-200">{config.label}</p>
              <p className="text-xs text-slate-500 mt-1">Ask a question to get started</p>
            </div>
            <div className="w-full space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Suggested questions</p>
              {config.suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${config.color} text-white`}>
                {config.icon}
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-slate-900 dark:bg-slate-700 text-white rounded-tr-none"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none"
              }`}
            >
              {msg.role === "assistant" && msg.content === "" && isLoading ? (
                <div className="flex gap-1 py-1">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}

              {msg.role === "assistant" && msg.decision && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <DecisionBadge decision={msg.decision} />
                  {msg.confidenceScore != null && msg.confidenceScore > 0 && (
                    <span className="text-[10px] text-slate-500">
                      {Math.round(msg.confidenceScore * 100)}% confidence
                    </span>
                  )}
                  {!msg.firewallEnabled && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-semibold">
                      Unverified
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border dark:border-slate-700 p-4">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask about ${config.label.toLowerCase()}…`}
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none rounded-xl border border-border dark:border-slate-600 px-4 py-3 text-sm bg-white dark:bg-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="px-4 py-3 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-sm font-semibold disabled:opacity-40 hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <span>↑</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function DecisionBadge({ decision }: { decision?: string }) {
  if (!decision || decision === "bypass" || decision === "unverified" || decision === "unknown") {
    return (
      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800">
        🔴 FIREWALL OFF — UNVERIFIED
      </span>
    )
  }

  const cls =
    decision === "pass"
      ? "bg-green-100 text-green-800 border-green-200"
      : decision === "rewrite"
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-red-100 text-red-800 border-red-200"
  const label =
    decision === "pass" ? "✓ PASS" : decision === "rewrite" ? "✏ REWRITE" : "✗ BLOCK"
  return (
    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${cls}`}>
      {label}
    </span>
  )
}
