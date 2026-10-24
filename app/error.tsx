"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function GlobalError({
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
    <html lang="en">
      <body className="min-h-screen bg-[#05050A] flex flex-col items-center justify-center gap-6 px-4 font-sans">
        <div className="text-5xl">💥</div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-white mb-2">Critical error</h1>
          <p className="text-sm text-gray-500 max-w-sm">
            {error.message || "Something went wrong at the application level."}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-lg border border-[#00D4FF]/40 text-[#00D4FF] text-sm hover:bg-[#00D4FF]/10 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg border border-[#1A1A2E] text-gray-400 text-sm hover:text-white transition-colors"
          >
            Go Home
          </Link>
        </div>
      </body>
    </html>
  )
}
