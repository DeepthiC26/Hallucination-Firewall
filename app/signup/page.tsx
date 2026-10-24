"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"

export default function SignUpPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!name || !email || !password) { setError("Please fill in all fields."); return }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return }
    setLoading(true)
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signup", name, email }),
      })
      if (!res.ok) throw new Error()
      router.push("/dashboard/knowledge-base")
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background grid-bg flex flex-col">
      <nav className="bg-white/80 backdrop-blur-sm border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5 w-fit group">
            <span className="text-xl">🛡</span>
            <span className="font-mono font-bold text-slate-900 text-sm tracking-wide group-hover:text-accent transition-colors">
              Hallucination Firewall
            </span>
          </Link>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-2xl border border-border shadow-card-hover p-8">
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🛡</span>
              </div>
              <h1 className="text-xl font-sans font-bold text-slate-900 mb-1">Create your account</h1>
              <p className="text-sm text-muted font-sans">Start protecting your AI responses today</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {[
                { label: "Full Name", type: "text", value: name, setter: setName, placeholder: "Alex Johnson", auto: "name" },
                { label: "Work Email", type: "email", value: email, setter: setEmail, placeholder: "alex@company.com", auto: "email" },
                { label: "Password", type: "password", value: password, setter: setPassword, placeholder: "Min. 6 characters", auto: "new-password" },
              ].map((field) => (
                <div key={field.label} className="flex flex-col gap-1.5">
                  <label className="text-xs font-sans font-semibold text-slate-600">{field.label}</label>
                  <input
                    type={field.type}
                    value={field.value}
                    onChange={(e) => field.setter(e.target.value)}
                    placeholder={field.placeholder}
                    autoComplete={field.auto}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3
                      text-sm font-sans text-slate-900 placeholder-subtle
                      focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
                  />
                </div>
              ))}

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-danger font-sans bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                >
                  {error}
                </motion.p>
              )}

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full py-3 rounded-xl font-sans font-semibold text-sm mt-1
                  bg-accent text-white hover:bg-accent-dark transition-colors
                  disabled:opacity-60 disabled:cursor-not-allowed shadow-accent"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                      className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    />
                    Creating account...
                  </span>
                ) : "Create Account →"}
              </motion.button>
            </form>

            <div className="mt-5 flex flex-col gap-1.5">
              {["No credit card required", "Local embeddings — no OpenAI key needed", "Full audit log from your first query"].map((b) => (
                <div key={b} className="flex items-center gap-2 text-xs text-muted font-sans">
                  <span className="text-safe font-bold">✓</span> {b}
                </div>
              ))}
            </div>

            <div className="mt-6 pt-5 border-t border-border text-center">
              <p className="text-sm text-muted font-sans">
                Already have an account?{" "}
                <Link href="/signin" className="text-accent hover:text-accent-dark font-semibold transition-colors">
                  Sign in
                </Link>
              </p>
            </div>

            <div className="mt-4 px-4 py-2.5 rounded-lg bg-accent/5 border border-accent/15 text-center">
              <p className="text-[11px] text-muted font-sans">
                Demo mode — fill in any values to access the dashboard
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
