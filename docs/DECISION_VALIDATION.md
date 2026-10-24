# Decision Validation Platform

Extends the Hallucination Firewall so decisions are **rule-based investigations**, not confidence-only RAG scoring.

See also: [`INVESTIGATION_PIPELINE.md`](./INVESTIGATION_PIPELINE.md) (Chapter 1 redesign).

## Modules (`lib/decision-validation/`)

| Module | Role |
|--------|------|
| `investigation_pipeline.ts` | Ordered Claim → Evidence → Consistency → Policy → Decision |
| `claim_support.ts` | Fully / Partially / Unsupported / Contradicted / Ambiguous |
| `claim_rewrite.ts` | Claim-preserving rewrite (verified text unchanged) |
| `deterministic_explanation.ts` | Explanations from measurable results (no LLM) |
| `stress_tests.ts` | 14 independent stages (pass/warn/fail) |
| `claim_investigation.ts` | Per-claim supporting/contradicting evidence + WHY |
| `decision_engine.ts` | Combines stages + claims → Pass/Rewrite/Block |

## Stages

Fact · Logic · Evidence Sufficiency · Contradiction · Authority · Freshness · Cross-doc Consistency · Domain Compliance · Privacy · Ethics · Medical Safety · Legal Compliance · Numerical · Temporal

Hard fails (block): medical safety, privacy, contradiction, cross-doc conflict, legal compliance.

**PASS** requires every factual statement independently verified.

## UI

- **Verification Console** — shows each stage pass/warn/fail + Decision Engine reason
- **Explainability** — claim investigations + full justification checklist
- **Analytics** — root cause distribution + knowledge gaps

Existing Trust OS / Safety / domain pipelines remain intact. UI/routing unchanged.
