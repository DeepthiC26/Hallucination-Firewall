"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

const NAV_GROUPS = [
  {
    group: "CORE",
    items: [
      { href: "/dashboard", label: "🛡 Firewall Demo", exact: true },
      { href: "/dashboard/verify", label: "Verification Console" },
    ]
  },
  {
    group: "KNOWLEDGE",
    items: [
      { href: "/dashboard/knowledge-base", label: "Knowledge Base" },
      { href: "/dashboard/history", label: "Memory" },
    ]
  },
  {
    group: "GOVERNANCE",
    items: [
      { href: "/dashboard/explainability", label: "Investigation" },
      { href: "/dashboard/analytics", label: "Analytics" },
      { href: "/dashboard/audit-logs", label: "Audit Logs" },
      { href: "/dashboard/trust-report", label: "Trust Report" },
    ]
  },
  {
    group: "DOMAINS",
    items: [
      { href: "/dashboard?domain=legal", label: "⚖️ Legal", exact: true },
      { href: "/dashboard?domain=healthcare", label: "🏥 Healthcare", exact: true },
      { href: "/dashboard?domain=enterprise", label: "🏢 Enterprise", exact: true },
      { href: "/dashboard/courtroom", label: "Courtroom" },
    ]
  },
  {
    group: "SETTINGS",
    items: [
      { href: "/dashboard/settings/llm", label: "LLM Providers" },
    ]
  }
]

export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentSearch, setCurrentSearch] = useState("")

  useEffect(() => {
    const stored = (localStorage.getItem("hf_theme") as "light" | "dark") || "light"
    setTheme(stored)
    document.documentElement.classList.toggle("dark", stored === "dark")
  }, [])

  useEffect(() => {
    setCurrentSearch(window.location.search)
  }, [pathname])

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light"
    setTheme(next)
    localStorage.setItem("hf_theme", next)
    document.documentElement.classList.toggle("dark", next === "dark")
  }

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:bg-[#0B1220] dark:text-slate-100 flex">
      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#0B1220] border-r border-border dark:border-slate-800 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} overflow-y-auto flex flex-col shadow-xl lg:shadow-none`}>
        <div className="p-5 border-b border-border dark:border-slate-800 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3 shrink-0">
            <span className="text-2xl">🛡️</span>
            <div className="leading-tight">
              <p className="text-sm font-mono font-bold tracking-wide">HALLUCINATION</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold tracking-[0.2em] uppercase">
                Firewall
              </p>
            </div>
          </Link>
          <button 
            className="lg:hidden text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-8">
          {NAV_GROUPS.map((group) => (
            <div key={group.group}>
              <h3 className="px-3 mb-3 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {group.group}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  let active = false
                  
                  if (item.href.includes("?domain=")) {
                    const itemDomain = item.href.split('=')[1]
                    const currentDomain = new URLSearchParams(currentSearch).get("domain")
                    active = pathname === "/dashboard" && currentDomain === itemDomain
                  } else if (item.exact) {
                    const currentDomain = new URLSearchParams(currentSearch).get("domain")
                    active = pathname === item.href && !currentDomain
                  } else {
                    active = pathname?.startsWith(item.href) || false
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-border dark:border-slate-800">
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "logout" }),
              })
              router.push("/")
              router.refresh()
            }}
            className="w-full px-3 py-2 text-left rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 border-b border-border bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-[#0B1220]/90 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
             <button
              type="button"
              onClick={toggleTheme}
              className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-slate-600 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "light" ? "🌙 Dark" : "☀️ Light"}
            </button>
          </div>
        </header>
        <main className="flex-1 relative">
          {children}
        </main>
      </div>
    </div>
  )
}
