# AI Investigation Report (Chapter 6)

Transforms Explainability into a **forensic investigation report** reconstructed from structured verification outputs — never from a secondary LLM.

## Principle

> Every decision must be reconstructable.

Identical verification results always produce the identical report.

## Report sections

1. **Original AI response** — unmodified  
2. **Claim investigations** — each factual statement independently  
3. **Evidence** — supporting / contradicting / missing (doc, page, section, sentence)  
4. **Evidence evaluation** — sufficiency, quality, conflicts, policy  
5. **Per-claim outcomes** — Verified · Partially Verified · Contradicted · Missing Evidence · Unsupported Inference · Policy Conflict · Outdated Knowledge · Unsafe Recommendation  
6. **Investigation timeline** — chronological stages  
7. **Response evolution** — Original → Investigated (annotated) → Verified  
8. **Hallucination taxonomy** — Unsupported Fact, Contradicted Fact, Unsupported Inference, Numerical, Temporal, Policy, Context, Fabricated Reference  
9. **Final decision** — why the Trust Verdict was taken  

## Modules

```
lib/investigation-report/
  engine.ts     # buildInvestigationReport
  classify.ts   # hallucination taxonomy
  types.ts
```

Attached to `/api/query` `final_response` and stored in `hf_last_verification`.  
UI: `/dashboard/explainability` (nav label: **Investigation Report**).
