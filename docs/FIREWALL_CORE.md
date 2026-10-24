# Firewall Core Algorithm

The Hallucination Firewall revolves around one **Firewall Core**. Pages only visualize its objects — they never decide independently.

## Philosophy

> AI is never trusted by default. Prefer **PASS → REWRITE → BLOCK**. Blocking is rare and reserved for unrecoverable safety risks. Low similarity never causes BLOCK.

> OpenRouter LLMs **never** decide whether an answer is correct. Generator output is untrusted input. Cross-Verifier opinions are advisory only. The Firewall compares the **generated answer** to uploaded knowledge-base evidence — never the user question alone to the document.

## Dual-model assist (OpenRouter)

```
User Question
  → Model 1 Generator (OPENROUTER_GENERATOR_MODEL) → Original AI Response (immutable)
  → Model 2 Cross-Verifier (OPENROUTER_CROSS_VERIFIER_MODEL) → advisory opinion only
  → Hallucination Firewall (deterministic) → Trust Verdict + Action
  → Final Verified Response
```

| Role | Responsibility |
|------|----------------|
| Generator | Draft answer only |
| Cross-Verifier | Suspected issues / focus hints — **not** Trust Verdict |
| Firewall Core | Sole PASS / REWRITE / BLOCK authority from KB evidence |

Disable Model 2 with `DISABLE_CROSS_VERIFIER=true`.

## Trust Verdicts

| Outcome | Trust Verdict | Action |
|---------|---------------|--------|
| All claims supported | **VERIFIED** | PASS |
| Recoverable hallucinations | **PARTIALLY VERIFIED** | REWRITE |
| Unrecoverable / unsafe | **UNVERIFIED / UNSAFE** | BLOCK |

## Mandatory Response Comparison

Every verification on `/dashboard/verify` shows:

- User Question
- Original AI Response
- Evidence Retrieved
- Claim-by-Claim Verification
- Inference Validation
- Policy & Safety Validation
- Cross-Verifier (advisory)
- Trust Verdict + Final Verified Response
- Detailed Investigation Summary

## Pipeline

```
Upload → Knowledge Intelligence → Index
→ Question → Original LLM Response (immutable)
→ Cross-Verifier (advisory)
→ Claim Objects → Evidence Objects → Inference Objects
→ Policy / Risk Objects → Response Recovery → Decision Object
→ Investigation / Trust / Analytics / Memory updates
→ Final Verified Response
```

## Response Recovery

`lib/firewall-core/response_recovery.ts` rewrites only unsupported claims from trusted evidence and preserves verified claims. It never requires high cosine similarity to recover. Rewrites are **not** produced by OpenRouter.

## Decision rules (softened)

- **BLOCK**: critical privacy leakage or unsafe medical content only
- **REWRITE**: contradictions, unsupported claims, reasoning leaps, conflicts, thin retrieval
- **PASS**: all claims verified

Early conflict exits and confidence-threshold blocks were removed.

## Core object

`assembleFirewallCoreResult` produces `firewallCore` (including optional `crossVerifier`) on every `final_response` and in session storage for Investigation Report / Trust / History consumers.

## Key files

- `lib/firewall-core/`
- `lib/openrouter.ts`
- `lib/cross-verifier/`
- `components/platform/ResponseComparison.tsx`
- `lib/decision-intelligence/rules.ts`
- `lib/decision-validation/claim_rewrite.ts`
- `lib/domains/pipeline.ts`
- `app/api/query/route.ts`
