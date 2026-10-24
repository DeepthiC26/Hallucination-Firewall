# Adaptive Firewall Memory & Learning Engine (Chapter 9)

> Every completed investigation becomes future intelligence.

The firewall memorises **investigations**, not answers.

## Pipeline

```
Query → Consult Investigation Memory → Adaptive strategy hints
      → Full verification
      → Soft adaptive escalation (never upgrades BLOCK→PASS)
      → Learn → Pattern Library + Investigation Memory
```

## Components

| Piece | Role |
|-------|------|
| Pattern Library (`hallucination-patterns.json`) | Recurring hallucination behaviours |
| Investigation Memory (`investigation-memory.json`) | Lessons, replay snapshots, similar priors |
| `consultInvestigationMemory` | Reuse prior strategy before new work |
| `learnFromInvestigation` | Extract lessons after every query |
| `applyAdaptiveMemoryEscalation` | Familiar failure patterns can demote PASS→REWRITE |
| Organisational Learning Dashboard | `/dashboard/history` |

## Replay

`GET /api/adaptive-memory?replay=<id>` reconstructs the original investigation from stored data — **never** regenerates with an LLM.

## Key files

- `lib/adaptive-memory/`
- `app/api/adaptive-memory/route.ts`
- `app/dashboard/history/page.tsx`
- Wired in `app/api/query/route.ts`
