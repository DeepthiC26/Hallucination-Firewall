# Evidence Intelligence Engine (Chapter 3)

Transforms retrieval from “closest chunk” search into **evidence investigation**.

## Principle

> Evidence is not accepted because it is similar. Evidence is accepted because it is trustworthy.

## Workflow (per claim)

```
ClaimObject
  → Discovery (multi-candidate KB retrieval)
  → Refinement (chunk → sentence-level units)
  → Assessment (relevance, completeness, authority, currency, contradiction)
  → Consolidation (evidence sets + conflict records)
  → ClaimEvidenceReport → Decision / Claim verification
```

## Quality checks

| Check | Behaviour |
|-------|-----------|
| Directly related | Reject unrelated sentences |
| Complete enough | Eligibility ≠ duration; missing numbers → partial |
| Authoritative | Domain hierarchy (Acts > notes; guidelines > memos; approved policy > draft) |
| Current | Superseded / outdated flagged |
| Consistent | Cross-document numeric conflicts recorded |
| Absence | No evidence is a first-class result |

## Authority hierarchy

- **Legal:** Acts/statutes → judgments → notes  
- **Healthcare:** Official guidelines → hospital protocols → unofficial  
- **Enterprise:** Approved HR policy → management procedures → drafts/memos  

Conflicts never silently pick a source — preferred document + human-review flag when equal.

## Modules

```
lib/evidence-intelligence/
  engine.ts        # runEvidenceIntelligence
  refine.ts        # sentence-level units
  assess.ts        # quality assessment
  authority.ts     # domain authority scores
  consolidate.ts   # support sets + conflicts
  types.ts
```

Wired via `verifyClaimsWithEvidence` in `lib/safety/claims.ts`.  
Verify console **Retrieved Evidence** panel shows supports / partially supports / contradicts / rejected / absent with reasons.
