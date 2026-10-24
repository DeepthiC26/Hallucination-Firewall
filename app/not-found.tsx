import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background grid-bg flex flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <p className="text-8xl font-mono font-bold text-border mb-2">404</p>
        <div className="text-4xl mb-4">🛡</div>
        <h1 className="text-xl font-sans font-semibold text-white mb-2">Page not found</h1>
        <p className="text-sm text-gray-500 font-sans max-w-xs mx-auto">
          This page doesn&apos;t exist. Head back to the firewall.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-lg bg-cyan-400/10 border border-cyan-400/40 text-cyan-400
            text-sm font-sans hover:bg-cyan-400/20 transition-colors"
        >
          Open Dashboard
        </Link>
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
