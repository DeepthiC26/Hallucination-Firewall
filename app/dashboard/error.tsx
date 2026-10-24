"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-4">
      <div className="text-5xl">⚠️</div>
      <div className="text-center">
        <h1 className="text-xl font-mono font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-sm text-gray-500 font-sans max-w-sm">
          {error.message || "An unexpected error occurred in the dashboard."}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-700 font-mono mt-2">Error ID: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-lg border border-cyan-400/40 text-cyan-400 text-sm font-sans
            hover:bg-cyan-400/10 transition-colors"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-lg border border-border text-gray-400 text-sm font-sans
            hover:border-gray-500 hover:text-white transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}
