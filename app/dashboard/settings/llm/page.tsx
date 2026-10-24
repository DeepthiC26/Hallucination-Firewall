"use client"

import { useEffect, useState } from "react"

type Provider = {
  id: string
  name: string
  models: { id: string; name: string }[]
}

export default function LLMSettings() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  
  const [defaultProvider, setDefaultProvider] = useState("")
  const [defaultModel, setDefaultModel] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: "", text: "" })

  const [testResult, setTestResult] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const [provRes, confRes] = await Promise.all([
          fetch("/api/llm/providers"),
          fetch("/api/llm/config")
        ])
        const provData = await provRes.json()
        const confData = await confRes.json()
        
        setProviders(provData)
        setDefaultProvider(confData.defaultProvider)
        setDefaultModel(confData.defaultModel)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage({ type: "", text: "" })
    try {
      const res = await fetch("/api/llm/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultProvider, defaultModel })
      })
      if (res.ok) {
        setMessage({ type: "success", text: "Configuration saved successfully." })
      } else {
        const err = await res.json()
        setMessage({ type: "error", text: err.error || "Failed to save." })
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/llm/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: defaultProvider, model: defaultModel })
      })
      const data = await res.json()
      if (res.ok) {
        setTestResult(`Success: ${data.text}`)
      } else {
        setTestResult(`Error: ${data.error}`)
      }
    } catch (err: any) {
      setTestResult(`Error: ${err.message}`)
    } finally {
      setTesting(false)
    }
  }

  const selectedProviderObj = providers.find(p => p.id === defaultProvider)

  if (loading) {
    return <div className="p-8">Loading settings...</div>
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">LLM Providers</h1>
        <p className="text-muted leading-relaxed">
          Configure the default Large Language Model used by the Hallucination Firewall generator. 
          Note that cross-verification uses OpenRouter to ensure consistency.
        </p>
      </header>

      <div className="bg-white dark:bg-slate-900 border border-border dark:border-slate-800 rounded-xl p-6 space-y-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium mb-2">Default Provider</label>
          <select 
            value={defaultProvider} 
            onChange={(e) => {
              setDefaultProvider(e.target.value)
              const prov = providers.find(p => p.id === e.target.value)
              if (prov && prov.models.length > 0) {
                setDefaultModel(prov.models[0].id)
              } else {
                setDefaultModel("")
              }
            }}
            className="w-full md:w-1/2 p-2.5 rounded-lg border border-border dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
          >
            {providers.length === 0 && <option value="">No providers available</option>}
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {providers.length === 0 && (
            <p className="text-xs text-red-500 mt-2">No providers configured. Please check your .env.local file.</p>
          )}
        </div>

        {selectedProviderObj && (
          <div>
            <label className="block text-sm font-medium mb-2">Default Model</label>
            <select 
              value={defaultModel} 
              onChange={(e) => setDefaultModel(e.target.value)}
              className="w-full md:w-1/2 p-2.5 rounded-lg border border-border dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
            >
              {selectedProviderObj.models.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-4 pt-6 border-t border-border dark:border-slate-800">
          <button 
            onClick={handleSave} 
            disabled={saving || providers.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Configuration"}
          </button>
          
          <button 
            onClick={handleTest} 
            disabled={testing || providers.length === 0}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>
        </div>

        {message.text && (
          <div className={`p-4 rounded-lg text-sm border ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50'}`}>
            {message.text}
          </div>
        )}

        {testResult && (
          <div className={`p-4 rounded-lg text-sm font-mono border ${testResult.startsWith('Success') ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50'}`}>
            {testResult}
          </div>
        )}
      </div>
    </div>
  )
}
