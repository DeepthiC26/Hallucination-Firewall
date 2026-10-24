"use client"

import Link from "next/link"
import {
  INVESTIGATION_JOURNEY,
  nextJourneyStep,
  previousJourneyStep,
  type JourneyStepId,
} from "@/lib/investigation-experience"

/**
 * Shared enterprise investigation journey strip (Chapter 10).
 * One continuous workflow — not isolated dashboards.
 */
export default function InvestigationJourney({
  current,
  showNext = true,
}: {
  current: JourneyStepId
  showNext?: boolean
}) {
  const next = showNext ? nextJourneyStep(current) : null
  const prev = previousJourneyStep(current)
  const currentStep = INVESTIGATION_JOURNEY.find((s) => s.id === current)

  return (
    <div className="rounded-xl border border-border bg-white/80 p-3 dark:bg-slate-900/80 dark:border-slate-700 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted">
          Investigation journey
        </p>
        {currentStep && (
          <p className="text-[11px] text-muted hidden sm:block">
            This stage investigates {currentStep.investigates}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {INVESTIGATION_JOURNEY.map((step, i) => {
          const active = step.id === current
          const done =
            INVESTIGATION_JOURNEY.findIndex((s) => s.id === current) > i
          return (
            <Link
              key={step.id}
              href={step.href}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                active
                  ? "bg-accent text-white border-accent"
                  : done
                    ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300"
                    : "border-border text-muted hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
              }`}
              title={step.investigates}
            >
              {step.short}
            </Link>
          )
        })}
      </div>
      {(prev || next) && (
        <div className="flex flex-wrap gap-3 text-[11px] pt-1 border-t border-border dark:border-slate-700">
          {prev && (
            <Link href={prev.href} className="text-muted hover:text-accent">
              ← {prev.label}
            </Link>
          )}
          {next && (
            <Link href={next.href} className="text-accent font-medium ml-auto">
              Next: {next.label} →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
