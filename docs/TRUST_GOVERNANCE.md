# AI Trust & Governance Intelligence Engine (Chapter 8)

Continuous organisational trust — not a single-answer confidence percentage.

> Trust should never be assumed. Trust must be continuously earned through verification.

## What it measures

| Signal | Effect on ecosystem trust |
|--------|---------------------------|
| Successful verifications (pass rate) | Increases |
| Hallucination / rewrite / block frequency | Decreases |
| Knowledge quality (Ch 7 health) | Increases when healthy |
| Conflicts, outdated docs, gaps | Decreases until resolved |
| Critical medical / privacy risks | Decreases |
| Governance discipline (audit governance scores) | Increases when strong |

## Outputs

`EcosystemGovernanceReport` via `GET /api/trust-governance`:

- **Ecosystem trust** + trend vs prior ledger snapshot
- **Domain health** (enterprise / legal / healthcare)
- **Open risks** (knowledge, policy, legal, medical, privacy, compliance) — remain until conditions clear
- **What is reducing / increasing trust**
- **Attention areas** and policies needing update
- **Trust evolution** timeline (`trust-governance-ledger.json`)
- **Unresolved investigations** from hallucination memory

## Wiring

- After each verified query (audit saved) → `recordVerificationTrustEvent`
- After knowledge upload → snapshot with knowledge drivers
- Trust Report page → executive governance dashboard (same route)

## Key files

- `lib/trust-governance/` — engine, risks, ledger
- `app/api/trust-governance/route.ts`
- `app/dashboard/trust-report/page.tsx`
