# Investigation Pipeline (Chapter 1 redesign)

Internal verification redesign — **no UI / routing / workflow changes**.

The Hallucination Firewall treats the LLM as an **untrusted information generator**. Every response is independently investigated before release.

## Philosophy

| Old (RAG-style) | New (Decision Validation) |
|-----------------|---------------------------|
| Verify whole paragraph | Verify every factual statement |
| One similarity / confidence score | Measurable multi-stage results |
| LLM-written explanations | Explanations derived from investigation results |
| Rewrite entire answer | Keep verified claims; correct only unsupported ones |
| Confidence gates Pass/Rewrite/Block | Decision Investigation is sole arbiter |

## Sequential stages

```
User Question → LLM → Raw AI Response (preserved)
  → Claim Investigation
  → Evidence Investigation
  → Consistency Investigation
  → Policy Investigation
  → Decision Investigation
  → Verified Response
```

| Phase | Module responsibility |
|-------|----------------------|
| Claim | `lib/safety/claims.ts` — decompose + classify Fully / Partially / Unsupported / Contradicted / Ambiguous |
| Evidence | Per-claim KB retrieval + `investigation_pipeline` evidence report |
| Consistency | Stochastic samples + cross-doc conflicts + claim contradictions |
| Policy | Domain / ethics / medical / legal / freshness triggers |
| Decision | `decision_engine.ts` — combines 14 stress stages + claim outcomes |

## Decision rules

- **PASS** — every factual statement independently verified (`fully_supported`); original text unchanged
- **REWRITE** — incorrect claims corrected from trusted evidence only; verified claims kept verbatim
- **BLOCK** — critical claims unsupported/contradictory, or hard policy failures

Confidence is **supporting context only** and never the sole criterion.

## Modules

```
lib/decision-validation/
  investigation_pipeline.ts   # five-phase orchestrator
  claim_support.ts            # five-way support classification
  claim_rewrite.ts            # claim-preserving assembly
  claim_investigation.ts      # per-claim WHY (measurable)
  deterministic_explanation.ts
  decision_engine.ts
  stress_tests.ts
```

## UI contract

Existing SSE stages and `decisionValidation` / `safety` / `claims` payloads are preserved so Verify, Explainability, Analytics, and Audit Logs continue to work without frontend changes.
