# Hallucination Simulation & Firewall Evaluation (Chapter 11)

> A security system should continuously test itself before trusting itself.

## Behaviour

1. LLM generates the **original** response (preserved).
2. Simulation creates a **reversible experimental copy** with a controlled hallucination.
3. The full verification pipeline investigates the experimental copy (no prior knowledge of the injection).
4. Evaluation records detection / miss, engines, stages, latency.
5. Experimental copy is discarded from organisational trust of the original; metrics persist.
6. Misses feed Adaptive Firewall Memory (stronger future checks).

Knowledge base is **never** modified.

## Categories

Unsupported fact · Contradicted fact · Unsupported inference · Numerical · Temporal · Policy · Fabricated reference · Context

## API / UI

- `POST /api/query` with `simulationMode: true` and optional `simulationCategory`
- `GET /api/simulation` — aggregate detection rates
- Verification Console → optional **Simulation Mode** (admin/research)

## Key files

- `lib/hallucination-simulation/`
- `app/api/simulation/route.ts`
- Wired in `app/api/query/route.ts` + `app/dashboard/verify/page.tsx`
