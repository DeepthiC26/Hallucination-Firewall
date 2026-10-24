# AI Investigation Experience & Enterprise Workflow (Chapter 10)

Unifies Chapters 1–9 into one continuous enterprise investigation — not a chatbot, not isolated dashboards.

## Investigation journey

| Step | Page | Investigates |
|------|------|----------------|
| 1 | Knowledge Base | Document quality before indexing |
| 2 | Verification | AI responses against trusted knowledge |
| 3 | Investigation Report | Claims, evidence, Trust Verdict |
| 4 | Trust & Governance | Organisational reliability over time |
| 5 | Analytics | Operational behaviour & root causes |
| 6 | Adaptive Memory | Historical learning |

Shared strip: `components/platform/InvestigationJourney.tsx`  
Stage language: `lib/investigation-experience/`

## Live verification

Verification Console shows **investigation stages** with human-readable progress (what the firewall is analysing), then auto-opens the Investigation Report.

## Design rules applied

- Preserve existing routes; strengthen relationships between pages
- No nested duplicate chrome on Analytics
- Prefer “relevance / evidence fit” over embedding jargon
- Each page states its job in the continuous workflow

## Key files

- `lib/investigation-experience/journey.ts`
- `components/platform/InvestigationJourney.tsx`
- `components/platform/PlatformShell.tsx` (nav order matches journey)
- Updated dashboard page intros + verify live experience
