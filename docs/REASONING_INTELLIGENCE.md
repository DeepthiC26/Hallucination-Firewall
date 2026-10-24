# Reasoning Intelligence Engine (Chapter 4)

Validates whether AI **conclusions** are logically justified by verified evidence.

## Principle

> Evidence proves facts. Reasoning proves conclusions.

A response is trustworthy only when **both** evidence and reasoning are correct.

## Why RAG fails here

Uploaded policy: “Employees receive sixteen weeks of paid maternity leave.”  
LLM: “…Therefore employees are allowed to transfer unused maternity leave…”

Similarity can still look high. Reasoning Intelligence rejects the transfer conclusion as an **unsupported inference**.

## Error categories

| Category | Meaning |
|----------|---------|
| Unsupported Inference | New info absent from evidence |
| Logical Jump | Unrelated conclusion from premises |
| Over-Generalisation | Absolute rule beyond document scope |
| Missing Condition | Omits if/unless/except from evidence |
| False Causality | Invented therefore/because links |
| Incorrect Combination | Cross-doc mashup no source supports |
| Context Loss | Ignores negations/limits in evidence |
| Domain Misinterpretation | Legal/medical/enterprise wording abuse |

## Workflow

```
Claim + Evidence Report
  → Novel-content / discourse analysis
  → Domain-specific rules
  → Accepted | Uncertain | Rejected + deterministic explanation
  → Demotes claim support / fails Logical Reasoning stress stage
  → Decision Engine
```

Explanations are built from verification results — **never** from a secondary LLM.

## Modules

```
lib/reasoning-intelligence/
  engine.ts
  detect.ts
  domain_rules.ts
  types.ts
```

Wired in `verifyClaimsWithEvidence` after Evidence Intelligence.  
Explainability shows a **Reasoning Investigation** panel with Accept/Reject explanations.
