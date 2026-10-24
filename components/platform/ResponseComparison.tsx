"use client"

/**
 * Mandatory Response Comparison — every verification must show
 * Generator output vs Firewall Core outcome side by side.
 */

type ClaimRow = {
  id: string
  claim: string
  verdict?: string
  supportStatus?: string
  investigationStatus?: string
  retrievedDocument?: string
}

type EvidenceRow = {
  documentName: string
  paragraph: string
  relation?: string
  authorityLevel?: string
  claimSnippet?: string
}

type InferenceRow = {
  claimId: string
  verdict: string
  conclusionJustified?: boolean
  explanation?: string
  errors?: string[]
}

type CrossVerifierView = {
  enabled: boolean
  model: string
  suspectedIssues: string[]
  suggestedFocus: string[]
  agreementHint: string
  note: string
} | null

export interface ResponseComparisonProps {
  query: string
  originalResponse: string
  finalResponse: string
  decision?: string
  trustVerdictLabel?: string
  actionLabel?: string
  reason?: string
  evidence: EvidenceRow[]
  claims: ClaimRow[]
  inferences?: InferenceRow[]
  policyCompliant?: boolean
  policyTriggers?: string[]
  ethicsLevel?: string
  medicalUnsafe?: boolean
  correctionsApplied?: string
  rootCauses?: string[]
  crossVerifier?: CrossVerifierView
  generatorModel?: string
  changedHighlight?: boolean
}

function trustBanner(decision?: string, label?: string, action?: string) {
  const d = decision || ""
  if (d === "pass") {
    return {
      className: "border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800",
      title: label || "VERIFIED",
      action: action || "PASS",
    }
  }
  if (d === "rewrite") {
    return {
      className: "border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800",
      title: label || "PARTIALLY VERIFIED",
      action: action || "REWRITE",
    }
  }
  if (d === "block" || d === "prompt_injection" || d === "conflict") {
    return {
      className: "border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800",
      title: label || "UNVERIFIED / UNSAFE",
      action: action || "BLOCK",
    }
  }
  return {
    className: "border-border bg-slate-50 dark:bg-slate-800/40 dark:border-slate-700",
    title: label || "—",
    action: action || "—",
  }
}

export default function ResponseComparison(props: ResponseComparisonProps) {
  const banner = trustBanner(
    props.decision,
    props.trustVerdictLabel,
    props.actionLabel
  )
  const changed =
    props.changedHighlight !== false &&
    props.originalResponse.trim() !== props.finalResponse.trim() &&
    props.decision === "rewrite"

  return (
    <div className="rounded-xl border-2 border-accent/40 bg-white p-4 dark:bg-slate-900 dark:border-accent/30 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-accent">
            Response Comparison
          </p>
          <p className="text-[11px] text-muted mt-0.5">
            OpenRouter generates the draft. The Hallucination Firewall alone decides PASS /
            REWRITE / BLOCK from knowledge-base evidence.
          </p>
        </div>
        <div className={`rounded-lg border px-3 py-2 text-right ${banner.className}`}>
          <p className="text-[10px] font-mono uppercase tracking-wide opacity-70">
            Trust Verdict
          </p>
          <p className="font-bold text-sm">{banner.title}</p>
          <p className="text-[11px] font-mono uppercase mt-0.5">Action: {banner.action}</p>
        </div>
      </div>

      <section className="space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted">
          User Question
        </p>
        <p className="text-sm font-medium">{props.query || "—"}</p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:bg-amber-950/20 dark:border-amber-800">
          <p className="text-[10px] font-mono uppercase tracking-widest text-amber-800 dark:text-amber-300 mb-1">
            Original AI Response
          </p>
          {props.generatorModel && (
            <p className="text-[10px] text-muted mb-2">Generator: {props.generatorModel}</p>
          )}
          <p className="text-sm whitespace-pre-wrap text-slate-800 dark:text-slate-200">
            {props.originalResponse || "—"}
          </p>
        </section>
        <section
          className={`rounded-lg border p-3 ${
            props.decision === "block"
              ? "border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800"
              : props.decision === "rewrite"
                ? "border-amber-200 bg-amber-50/40 dark:bg-amber-950/15 dark:border-amber-800"
                : "border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800"
          }`}
        >
          <p className="text-[10px] font-mono uppercase tracking-widest mb-1">
            Final Verified Response
          </p>
          {props.decision === "block" ? (
            <p className="text-sm text-red-800 dark:text-red-300">
              Blocked — original response was not released. {props.reason || ""}
            </p>
          ) : (
            <p className="text-sm whitespace-pre-wrap text-slate-800 dark:text-slate-200">
              {props.finalResponse || "—"}
            </p>
          )}
          {changed && (
            <p className="mt-2 text-[11px] font-semibold text-amber-800 dark:text-amber-300 border-t border-amber-200/80 dark:border-amber-800 pt-2">
              Changed: Firewall rewrote unsupported claims using knowledge-base evidence.
              {props.correctionsApplied ? ` ${props.correctionsApplied}` : ""}
            </p>
          )}
        </section>
      </div>

      <section className="space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted">
          Evidence Retrieved
        </p>
        {props.evidence.length === 0 ? (
          <p className="text-xs text-muted">No evidence snippets attached.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-auto">
            {props.evidence.slice(0, 8).map((ev, i) => (
              <div
                key={i}
                className="rounded border border-border px-2.5 py-2 text-[11px] dark:border-slate-700"
              >
                <div className="flex justify-between gap-2 mb-0.5">
                  <span className="font-semibold">{ev.documentName}</span>
                  <span className="uppercase font-mono text-muted">
                    {(ev.relation || "supports").replace(/_/g, " ")}
                  </span>
                </div>
                {ev.authorityLevel && (
                  <p className="text-muted mb-0.5">{ev.authorityLevel} authority</p>
                )}
                <p className="text-slate-700 dark:text-slate-300 line-clamp-3">{ev.paragraph}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted">
          Claim-by-Claim Verification
        </p>
        {props.claims.length === 0 ? (
          <p className="text-xs text-muted">No claims extracted.</p>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-auto">
            {props.claims.map((c) => (
              <div
                key={c.id}
                className="rounded border border-border px-2.5 py-2 text-[11px] dark:border-slate-700"
              >
                <div className="flex justify-between gap-2 font-mono text-[10px] uppercase tracking-wide text-muted mb-0.5">
                  <span>{c.id}</span>
                  <span>
                    {(c.investigationStatus || c.supportStatus || c.verdict || "unknown").replace(
                      /_/g,
                      " "
                    )}
                  </span>
                </div>
                <p className="text-sm">{c.claim}</p>
                {c.retrievedDocument && (
                  <p className="text-muted mt-0.5">Evidence: {c.retrievedDocument}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted">
          Inference Validation
        </p>
        {!props.inferences?.length ? (
          <p className="text-xs text-muted">
            Inference checks are included in the investigation pipeline when reasoning
            intelligence runs.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-auto">
            {props.inferences.map((inf) => (
              <div
                key={inf.claimId}
                className="rounded border border-border px-2.5 py-2 text-[11px] dark:border-slate-700"
              >
                <div className="flex justify-between gap-2 font-semibold">
                  <span>{inf.claimId}</span>
                  <span className="uppercase font-mono">{inf.verdict}</span>
                </div>
                <p className="mt-0.5 opacity-80">
                  {inf.explanation ||
                    (inf.conclusionJustified
                      ? "Conclusion justified by evidence"
                      : "Conclusion not justified")}
                </p>
                {(inf.errors || []).length > 0 && (
                  <p className="text-red-700 dark:text-red-300 mt-0.5">
                    {(inf.errors || []).join("; ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
        <div className="rounded-lg border border-border p-3 dark:border-slate-700">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">
            Policy & Safety Validation
          </p>
          <p>
            Compliant:{" "}
            <strong>
              {props.policyCompliant == null
                ? "—"
                : props.policyCompliant
                  ? "yes"
                  : "no"}
            </strong>
          </p>
          <p>Ethics: {props.ethicsLevel || "—"}</p>
          <p>Medical unsafe: {props.medicalUnsafe ? "yes" : "no"}</p>
          {(props.policyTriggers || []).length > 0 && (
            <p className="mt-1 text-muted">Triggers: {props.policyTriggers!.join(", ")}</p>
          )}
        </div>
        <div className="rounded-lg border border-border p-3 dark:border-slate-700">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">
            Cross-Verifier (advisory)
          </p>
          {!props.crossVerifier?.enabled ? (
            <p className="text-muted">
              {props.crossVerifier?.note || "Not available for this run"}
            </p>
          ) : (
            <>
              <p className="text-muted mb-1">Model: {props.crossVerifier.model}</p>
              <p>
                Hint:{" "}
                <strong className="uppercase">{props.crossVerifier.agreementHint}</strong>
              </p>
              {(props.crossVerifier.suspectedIssues || []).length > 0 && (
                <ul className="mt-1 space-y-0.5 text-muted">
                  {props.crossVerifier.suspectedIssues.slice(0, 5).map((issue, i) => (
                    <li key={i}>• {issue}</li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[10px] opacity-70">{props.crossVerifier.note}</p>
            </>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border p-3 dark:border-slate-700 text-[11px] space-y-1">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted mb-1">
          Detailed Investigation Summary
        </p>
        <p>
          <span className="font-semibold">Firewall reason:</span> {props.reason || "—"}
        </p>
        {props.correctionsApplied && (
          <p>
            <span className="font-semibold">Corrections:</span> {props.correctionsApplied}
          </p>
        )}
        {(props.rootCauses || []).length > 0 && (
          <p>
            <span className="font-semibold">Root causes:</span>{" "}
            {props.rootCauses!.join("; ")}
          </p>
        )}
        <p className="text-muted pt-1 border-t border-border dark:border-slate-700 mt-2">
          Neither the Generator nor the Cross-Verifier assigned this Trust Verdict — the
          deterministic Hallucination Firewall did, by comparing the original answer to
          uploaded knowledge-base evidence.
        </p>
      </section>
    </div>
  )
}
