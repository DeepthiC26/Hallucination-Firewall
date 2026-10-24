# AI Safety Platform Extension

Extends the existing Next.js Hallucination Firewall into a multi-page **Enterprise AI Safety Platform**.
Does **not** replace RAG, domain pipelines, reliability layer, or APIs — only adds middleware UX + safety modules.

## Pages

| Route | Purpose |
|-------|---------|
| `/dashboard/knowledge-base` | Upload PDF/DOCX/TXT · Enterprise/Legal/Healthcare · Continue → Verify |
| `/dashboard/verify` | Evidence vs Raw LLM · Firewall pipeline · PASS/REWRITE/BLOCK |
| `/dashboard/explainability` | Claim reasoning · Heatmap · Side-by-side comparison |
| `/dashboard/analytics` | Domain filters · Trust/Governance/Evidence metrics |
| `/dashboard/audit-logs` | Searchable audit (replaces History) |

## New modules (`lib/safety/`)

- `claims.ts` — claim-level independent verification
- `evidence_strength.ts` — evidence meter + severity
- `governance.ts` — governance %
- `ethics.ts` — privacy/bias/medical/legal risks
- `trust_extended.ts` — 6-factor trust score
- `document_health.ts` — outdated/duplicate/weak docs
- `build_report.ts` — SafetyPlatformReport for SSE/audit
- `session.ts` — browser session for explainability handoff

## Upload formats

PDF · DOCX (`mammoth`) · TXT → embeddings → domain collections (`enterprise_kb` / `legal_kb` / `healthcare_kb`).

## Theme

Light / Dark via `html.dark` class + PlatformShell toggle.
