# AI Trust Operating System

Extends the existing Hallucination Firewall into a production-grade **AI Trust OS**.
Does **not** redesign RAG, domain pipelines, or existing APIs — engines plug in additively.

## Engines (`lib/trust-os/`)

| # | Engine | Module |
|---|--------|--------|
| 1 | Multi-Agent Cross Examination | `courtroom.ts` |
| 2 | Reasoning Verification | `reasoning.ts` |
| 3 | Root Cause | `root_cause.ts` |
| 4 | Knowledge Conflict Resolver | `conflict_resolver.ts` |
| 5 | Predictive Hallucination | `predictive.ts` |
| 6 | Adaptive Firewall | `predictive.ts` |
| 7 | Hallucination Memory | `memory.ts` → `hallucination-memory.json` |
| 8 | Document Health | reuses `lib/safety/document_health.ts` |
| 9 | Knowledge Gap Discovery | `knowledge_gaps.ts` |
| 10 | Trust Radar | `trust_radar.ts` |
| 11 | Governance | `trust_radar.ts` |
| 12 | AI Safety flags | `trust_radar.ts` + ethics |
| 13 | Cognitive Trace | `reasoning.ts` |
| 14 | Hallucination DNA | `root_cause.ts` |
| 15 | Vulnerability Scanner | `vulnerability.ts` |

Orchestrator: `lib/trust-os/orchestrator.ts` → attached as `trustOs` on audit + SSE `final_response`.

## UI flow

Knowledge Base → Verification → **AI Courtroom** → **Trust Report** → Explainability → Analytics → Audit Logs

## New APIs (additive)

- `GET /api/trust-os/memory`
- `GET /api/trust-os/vulnerability`
- `GET /api/trust-os/knowledge-gaps`
