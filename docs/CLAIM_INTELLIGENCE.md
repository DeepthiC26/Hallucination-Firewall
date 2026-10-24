# Claim Intelligence Engine (Chapter 2)

First intelligent layer of the Hallucination Firewall. **Understands** LLM output before any evidence retrieval or decision making.

## Principle

> The firewall does not verify answers. The firewall verifies claims.

A claim is the smallest unit of factual information that can be independently proven or disproven.

## Workflow

```
Raw LLM Response
  → Sentence boundaries
  → Filter non-factual (greetings, opinions, fillers)
  → Decompose composite sentences
  → Classify category
  → Enrich metadata (entities, numbers, dates, legal, medical, policy)
  → ClaimObject[] → verification pipeline (never merged)
```

## Claim categories

`factual` · `numerical` · `temporal` · `legal` · `medical` · `enterprise_policy` · `procedural` · `composite` (decomposed into atoms)

## Claim object fields

`id`, `originalClaim`, `category`, `domain`, named entities, numbers, dates, legal sections, medical terms, policy references, `investigationStatus`, `isFactual`

## Investigation statuses (Verify console)

Waiting for Evidence → Evidence Retrieved → Under Verification → Verified | Contradicted | Rewritten | Blocked

## Modules

```
lib/claim-intelligence/
  engine.ts      # runClaimIntelligence
  extract.ts     # factual filter + composite decompose
  classify.ts    # category classification
  enrich.ts      # metadata enrichment
  types.ts
```

Wired in `lib/safety/claims.ts` and `/api/query` **before** per-claim KB retrieval.
