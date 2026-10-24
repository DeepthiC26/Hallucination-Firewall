# Knowledge Intelligence Engine (Chapter 7)

The Knowledge Intelligence Engine investigates uploaded documents **before** they are trusted for AI retrieval.

> A Hallucination Firewall must validate its knowledge before validating the AI.

## Pipeline

```
Upload → Extract text → Knowledge Intelligence → Embed → Index → Knowledge Health Report
```

Investigation covers:

| Check | Module | Outcome |
|-------|--------|---------|
| Quality / OCR / completeness | `quality.ts` | flags + scores |
| Authority hierarchy | evidence `authority.ts` | primary / secondary / tertiary |
| Duplicates | `integrity.ts` | exact family / near-duplicate |
| Conflicts | `integrity.ts` | numeric + topic clashes vs corpus |
| Freshness | `integrity.ts` | current / aging / outdated / historical |
| Knowledge gaps | `integrity.ts` | missing policy / protocol hints |

## Index decisions

- **`index`** — high quality; trusted for verification
- **`index_with_warnings`** — searchable but flagged (duplicates, conflicts, aging, tertiary authority)
- **`hold`** — severe quality issues; still indexed with heavy flags; `trustForVerification = false`

Documents are never silently trusted. Problems become metadata on the registry and on vector chunks (`authorityLevel`, `knowledgeQuality`, `knowledgeTrust`, …).

## API / UI

- `POST /api/upload` runs `runKnowledgeIntelligence` before embedding and returns `knowledgeHealth`
- Registry stores `knowledgeHealth`, `contentFingerprint`, `knowledgePreview`
- Knowledge Base page shows investigation progress, a **Knowledge Health Report** after upload, and expandable per-document health in the table
- Document Health sidebar aggregates reliability, gaps, warned/held counts

## Key files

- `lib/knowledge-intelligence/` — engine + types
- `app/api/upload/route.ts` — gated ingest
- `lib/doc-registry.ts` — health metadata
- `lib/safety/document_health.ts` — corpus health from reports
- `app/dashboard/knowledge-base/page.tsx` — UX (same page, enriched)
