# Decision Intelligence Engine (Chapter 5)

Final authority of the Hallucination Firewall — the **judge**. Prior engines investigate; this engine only synthesises.

## Principle

> The firewall does not decide because it is confident. The firewall decides because the evidence justifies the decision.

- Never analyses raw LLM text directly  
- Never uses confidence as the sole criterion  
- Never asks another LLM to judge  
- Same investigation inputs → same decision (deterministic / reproducible)

## Inputs (synthesis only)

Claim Intelligence · Evidence Intelligence · Reasoning Intelligence · stress stages · ethics/policy · contradictions · domain outcomes

## Decision rules

| Outcome | When |
|---------|------|
| **PASS** | All claims verified, evidence sufficient, reasoning accepted, no contradictions, no policy/safety violations |
| **REWRITE** | Unsupported / reasoning-failed claims can be corrected from trusted KB evidence; verified claims unchanged |
| **BLOCK** | Critical unverifiable info, unresolved contradictions, privacy/safety, domain-critical failures, or uncorrectable gaps |

## Risk & domain

Failures classified **minor / major / critical**.  
Healthcare prioritises patient safety; Legal prioritises statutory correctness; Enterprise prioritises policy governance.

## Transparency

Every decision includes a checklist (Chapter 5.4 questions), claims passed/failed, evidence, contradictions, policies, primary cause, rules fired, and an explicit confidence disclaimer.

## Modules

```
lib/decision-intelligence/
  engine.ts   # runDecisionIntelligence
  rules.ts    # deterministic PASS/REWRITE/BLOCK
  risk.ts     # severity + domain priority
  types.ts
```

Wired as the sole PASS/REWRITE authority in `runInvestigationPipeline`.  
Verify console **Decision Intelligence** panel expands to the investigation summary.
