"use client"

import Link from "next/link"
import { motion, useInView } from "framer-motion"
import { useRef } from "react"

const FEATURES = [
  {
    icon: "🔍",
    title: "Sentence-Level Fact Check",
    desc: "Every sentence in the LLM response is individually embedded and compared against your knowledge base using cosine similarity.",
    accent: "border-l-accent",
  },
  {
    icon: "📊",
    title: "Confidence Scoring",
    desc: "A weighted formula combines the fact score and hallucination ratio into a single confidence number that drives the final decision.",
    accent: "border-l-violet-500",
  },
  {
    icon: "⚖️",
    title: "Domain-Aware Thresholds",
    desc: "Finance and legal domains apply stricter thresholds than HR or general queries — because the cost of a wrong answer differs by context.",
    accent: "border-l-uncertain",
  },
  {
    icon: "✍️",
    title: "Auto-Rewrite with Sources",
    desc: "When confidence is borderline, the firewall rewrites the response using real KB context — not a refusal, a correction.",
    accent: "border-l-safe",
  },
  {
    icon: "🛡",
    title: "Hard Block",
    desc: "When confidence is too low for the domain, the response is suppressed entirely with a clear audit trail.",
    accent: "border-l-danger",
  },
  {
    icon: "📋",
    title: "Full Audit Log",
    desc: "Every query, score, decision, and source citation is persisted. Compliance teams get a real-time view of every AI decision.",
    accent: "border-l-slate-400",
  },
]

const PIPELINE = [
  { num: "01", label: "Query In", desc: "User asks a question", color: "#0891B2" },
  { num: "02", label: "LLM Generates", desc: "AI produces raw response", color: "#7C3AED" },
  { num: "03", label: "Fact Check", desc: "Each sentence hits Pinecone", color: "#0891B2" },
  { num: "04", label: "Score Engine", desc: "Confidence calculated", color: "#D97706" },
  { num: "05", label: "Decision", desc: "PASS / REWRITE / BLOCK", color: "#16A34A" },
]

const OUTCOMES = [
  { icon: "✅", label: "PASS", color: "text-safe", bg: "bg-green-50 border-green-200", desc: "Response verified — delivered as-is with source citations." },
  { icon: "✏️", label: "REWRITE", color: "text-uncertain", bg: "bg-amber-50 border-amber-200", desc: "Corrections applied using KB context. Grounded answer replaces the original." },
  { icon: "🚫", label: "BLOCK", color: "text-danger", bg: "bg-red-50 border-red-200", desc: "Response suppressed. No hallucinated data reaches the user. Audit entry created." },
]

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-60px" })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-slate-900 overflow-x-hidden">
      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🛡</span>
            <span className="font-mono font-bold text-slate-900 text-sm tracking-wide">
              Hallucination Firewall
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/signin"
              className="text-sm font-sans text-muted hover:text-slate-900 transition-colors px-4 py-2 rounded-lg hover:bg-slate-100"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-sm font-sans font-semibold px-4 py-2 rounded-lg
                bg-accent text-white hover:bg-accent-dark transition-colors shadow-sm"
            >
              Get Started →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative grid-bg py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-xs font-mono text-accent mb-8"
          >
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="w-1.5 h-1.5 rounded-full bg-accent inline-block"
            />
            Real-time LLM fact verification · Pinecone + MiniLM-L6
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="text-5xl md:text-6xl font-sans font-bold leading-[1.1] mb-5 text-slate-900"
          >
            Stop AI from{" "}
            <span className="bg-gradient-to-r from-accent via-violet-600 to-accent bg-clip-text text-transparent">
              hallucinating facts
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="text-lg text-muted font-sans max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            An enterprise AI safety layer that intercepts every LLM response, verifies it
            sentence-by-sentence against your knowledge base, and either passes, rewrites,
            or blocks it — in under 2 seconds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link
              href="/signup"
              className="px-8 py-3.5 rounded-xl font-sans font-semibold text-sm
                bg-accent text-white hover:bg-accent-dark transition-colors shadow-accent"
            >
              Launch the Demo →
            </Link>
            <Link
              href="/signin"
              className="px-8 py-3.5 rounded-xl font-sans font-semibold text-sm
                bg-white border border-border text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-card"
            >
              Sign In
            </Link>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-10 flex flex-wrap justify-center gap-4 text-xs text-muted font-sans"
          >
            {["No OpenAI key needed", "Free to run", "Local embeddings", "Open source stack"].map((b) => (
              <span key={b} className="flex items-center gap-1.5">
                <span className="text-safe">✓</span> {b}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-white border-y border-border py-6">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: "< 2s", label: "Pipeline Latency" },
            { value: "384-dim", label: "Vector Space" },
            { value: "3 Domains", label: "Legal · HR · Finance" },
            { value: "100%", label: "Free to Run" },
          ].map((s, i) => (
            <FadeIn key={s.label} delay={i * 0.05} className="text-center">
              <p className="text-2xl font-mono font-bold text-slate-900 mb-0.5">{s.value}</p>
              <p className="text-xs font-sans text-muted uppercase tracking-wider">{s.label}</p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <p className="text-xs font-mono text-accent uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-slate-900">
              Every query through the firewall
            </h2>
          </FadeIn>

          {/* Pipeline */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-0">
            {PIPELINE.map((step, i) => (
              <div key={step.num} className="flex flex-col md:flex-row items-center">
                <FadeIn delay={i * 0.1} className="flex flex-col items-center text-center px-5 py-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-card"
                    style={{ backgroundColor: step.color + "15", border: `1.5px solid ${step.color}30` }}
                  >
                    <span className="font-mono font-bold text-sm" style={{ color: step.color }}>{step.num}</span>
                  </div>
                  <p className="text-xs font-mono font-semibold text-slate-700 uppercase tracking-wider mb-0.5">{step.label}</p>
                  <p className="text-xs font-sans text-muted max-w-[90px]">{step.desc}</p>
                </FadeIn>
                {i < PIPELINE.length - 1 && (
                  <motion.div
                    animate={{ x: [0, 5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="hidden md:block text-slate-300 text-xl px-1"
                  >
                    →
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          {/* Outcomes */}
          <FadeIn delay={0.5} className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
            {OUTCOMES.map((o) => (
              <motion.div
                key={o.label}
                whileHover={{ y: -3 }}
                className={`rounded-xl border p-5 ${o.bg} shadow-card transition-all`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{o.icon}</span>
                  <span className={`font-mono font-bold text-sm tracking-widest ${o.color}`}>{o.label}</span>
                </div>
                <p className="text-sm text-slate-600 font-sans leading-relaxed">{o.desc}</p>
              </motion.div>
            ))}
          </FadeIn>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20 px-6 bg-white border-y border-border">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <p className="text-xs font-mono text-violet-600 uppercase tracking-widest mb-3">Built for enterprise AI</p>
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-slate-900">Every layer is real</h2>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.07}>
                <motion.div
                  whileHover={{ y: -3 }}
                  className={`h-full rounded-xl border border-border bg-white p-5 shadow-card hover:shadow-card-hover transition-all border-l-4 ${f.accent}`}
                >
                  <div className="text-2xl mb-3">{f.icon}</div>
                  <h3 className="text-sm font-sans font-semibold text-slate-900 mb-1.5">{f.title}</h3>
                  <p className="text-xs font-sans text-muted leading-relaxed">{f.desc}</p>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Upload your PDF callout */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <div className="bg-white rounded-2xl border border-border shadow-card-hover p-10 flex flex-col md:flex-row gap-8 items-center">
              <div className="text-6xl shrink-0">📄</div>
              <div className="flex-1">
                <p className="text-xs font-mono text-accent uppercase tracking-widest mb-2">Your documents</p>
                <h2 className="text-2xl font-sans font-bold text-slate-900 mb-3">
                  Upload your own PDFs — get instant RAG
                </h2>
                <p className="text-slate-600 font-sans text-sm leading-relaxed mb-6">
                  Open the Knowledge Base sidebar in the dashboard, drop in any PDF (contracts, policies, manuals),
                  and the firewall will immediately start fact-checking AI responses against your real documents.
                  No setup. No config. Just drag, drop, and ask.
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent text-white font-sans font-semibold text-sm hover:bg-accent-dark transition-colors shadow-accent"
                >
                  Try it now →
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-slate-900">
        <FadeIn className="max-w-2xl mx-auto text-center">
          <div className="text-5xl mb-5">🛡</div>
          <h2 className="text-3xl font-sans font-bold text-white mb-3">Ready to try it?</h2>
          <p className="text-slate-400 font-sans mb-8 text-base">
            Free to run. No OpenAI key needed. Just add your Pinecone and OpenRouter keys.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="px-8 py-3.5 rounded-xl font-sans font-semibold text-sm bg-accent text-white hover:bg-accent-dark transition-colors shadow-accent"
            >
              Create Account →
            </Link>
            <Link
              href="/signin"
              className="px-8 py-3.5 rounded-xl font-sans font-semibold text-sm bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-[11px] font-mono text-slate-600">
          <span>🛡 HALLUCINATION FIREWALL — stepfun/step-3.5-flash · Pinecone · MiniLM-L6-v2</span>
          <span>Next.js 14 · Tailwind CSS · Framer Motion</span>
        </div>
      </footer>
    </div>
  )
}
