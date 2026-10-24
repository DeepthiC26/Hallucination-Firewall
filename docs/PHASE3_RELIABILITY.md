# Phase 3 — AI Reliability & Performance Layer

Modular extension that plugs into the existing Enterprise / Legal / Healthcare pipelines.
**Does not redesign** fact-check, domain verification, or RAG architecture.

---

## Modules (`lib/reliability/`)

| Module | File | Role |
|--------|------|------|
| Stochastic Output Verification | `consistency.ts` | 3 LLM samples → pairwise cosine similarity → Consistency Score |
| Latency Monitoring | `latency.ts` | retrieval / LLM / verification / rewrite / consistency / total ms |
| Hallucination Risk Prediction | `risk_predictor.ts` | Pre-verify P(hallucination) from retrieval + evidence |
| Document Freshness | `freshness.ts` | Detect superseded/outdated docs; re-rank retrieval |
| Trust Score Engine | `trust_score.ts` | 0.30 Evidence + 0.25 Consistency + 0.15 Freshness + 0.30 Confidence |
| Failure Classification | `failure_classifier.ts` | Missing Evidence / Conflicting / Outdated / Low Similarity / Unsupported |
| Orchestrator | `index.ts` | Evidence snippets + explanation enrichment |

---

## Pipeline attachment (`/api/query`)

```
Domain Detector → Retrieval (+ freshness re-rank) → Risk Prediction
→ Conflict check → LLM → Stochastic Consistency (3×)
→ Fact Check → Domain Verification → Trust Score → Failure Class
→ Allow / Rewrite / Block → Audit (+ reliability payload)
```

SSE stage added: `reliability`.

Disable stochastic sampling (faster): set `DISABLE_STOCHASTIC_VERIFY=true`.

---

## Audit / schema extras

Persisted on each `AuditEntry` / `FirewallResult`:

- `reliability: ReliabilityReport`
- `trustScore: number`
- `consistencyScore: number`
- `failureClass: FailureClass`
- `responseTimeMs` (total; also broken down inside `reliability.latency`)

---

## Evaluation metrics (dashboard)

- PASS / REWRITE / BLOCK counts
- Hallucination rate by domain
- Average confidence, trust, consistency
- Average retrieval / LLM / verification latency
- Trust score trend
- Failure classification histogram

---

## Explainability

Response panel shows:

- Supporting documents + evidence snippets + similarity
- Confidence + Trust scores
- Latency breakdown
- Exact failure reason for blocked answers
