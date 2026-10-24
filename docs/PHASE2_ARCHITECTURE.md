# Phase 2 — Multi-Domain Hallucination Firewall

Modular extension of the existing Next.js RAG + verification architecture.
**Does not redesign** the enterprise pipeline; domain modules plug in via detection → collection routing → domain verifiers.

> Stack note: this repo is **Next.js + TypeScript + Pinecone** (not FastAPI/ChromaDB/Python).
> Collection names (`enterprise_kb`, `legal_kb`, `healthcare_kb`) are the ChromaDB-equivalent namespaces on vector metadata.

---

## 1. Folder structure

```
hallucination-firewall/
├── app/
│   ├── api/
│   │   ├── query/route.ts          # Domain detector + domain verification SSE
│   │   ├── upload/route.ts         # PDF ingest + OCR + auto domain routing
│   │   ├── analytics/route.ts      # Includes domainAnalytics
│   │   └── kb-status/route.ts      # Collection / domain counts
│   └── dashboard/
│       ├── page.tsx                # Pipeline UI + domain detection stage
│       └── analytics/page.tsx      # Enterprise / Legal / Healthcare cards
├── components/
│   ├── ResponsePanel.tsx           # Legal / medical evidence cards
│   └── KnowledgeBaseSidebar.tsx    # Domain selector on upload
├── lib/
│   ├── pdf_ocr.ts                  # Scanned PDF OCR fallback
│   ├── firewall.ts                 # Domain-aware thresholds
│   ├── pinecone.ts                 # Collection-filtered retrieval
│   ├── analytics.ts                # Domain analytics aggregation
│   └── domains/
│       ├── domain_detector.ts      # Enterprise | Legal | Healthcare routing
│       ├── thresholds.ts           # 80% / 95% / 98%
│       ├── kb_collections.ts       # enterprise_kb | legal_kb | healthcare_kb
│       ├── pipeline.ts             # Orchestrator + system prompts
│       ├── prompts.ts              # Prompt templates
│       ├── legal/
│       │   ├── extractor.ts        # Acts, sections, clauses, citations
│       │   └── verifier.ts         # Legal citation / clause verification
│       └── healthcare/
│           ├── extractor.ts        # Drugs, dosages, ICD, guidelines
│           └── verifier.ts         # Safety / grounding verification
└── types/index.ts                  # FirewallDomain, DomainVerification
```

---

## 2. Architecture flow

```
User Query (+ optional PDF docId)
        ↓
Domain Detector  →  enterprise | legal | healthcare
        ↓
KB Collection    →  enterprise_kb | legal_kb | healthcare_kb
        ↓
Retriever (Pinecone / local index)
        ↓
LLM (domain system prompt)
        ↓
Fact Check (existing)
        ↓
Domain Hallucination Firewall
  • Legal: citation / section / act / clause
  • Healthcare: dosage / disease–treatment / contraindications
  • Enterprise: coverage + 80% threshold
        ↓
Confidence Score → Allow / Rewrite / Block
        ↓
Audit Log + Domain Analytics Dashboard
```

---

## 3. Domain thresholds

| Domain      | PASS (Allow) | REWRITE floor |
|-------------|--------------|---------------|
| Enterprise  | > 80%        | ≥ 65%         |
| Legal       | > 95%        | ≥ 85%         |
| Healthcare  | > 98%        | ≥ 90%         |

Unsafe / ungrounded healthcare claims and unsupported legal authority → hard **BLOCK**.

---

## 4. Vector “collections” (schema)

Each vector metadata record:

| Field            | Type     | Notes                                      |
|------------------|----------|--------------------------------------------|
| `text`           | string   | Chunk body                                 |
| `title`          | string   | Document title                             |
| `domain`         | string   | Legacy tag (`legal`, `hr`, `healthcare`…)  |
| `firewallDomain` | string   | `enterprise` \| `legal` \| `healthcare`    |
| `collection`     | string   | `enterprise_kb` \| `legal_kb` \| `healthcare_kb` |
| `docId`          | string   | Registry / PDF scope id                    |
| `chunkIndex`     | number   | Chunk order                                |
| `filename`       | string   | Original PDF name                          |

Audit entry extras: `firewallDomain`, `domainVerification`, `docId`, `docTitle`, `responseTimeMs`.

---

## 5. API endpoints

| Method | Path              | Role |
|--------|-------------------|------|
| POST   | `/api/query`      | Domain detect → retrieve → LLM → verify → SSE |
| POST   | `/api/upload`     | PDF (+ OCR) → detect domain → embed → collection |
| GET    | `/api/analytics`  | Metrics + `domainAnalytics[]` |
| GET    | `/api/kb-status`  | Vector / domain / collection stats |
| GET/DELETE | `/api/audit-log` | History / audit |

---

## 6. Python / ChromaDB mapping (conceptual)

If you later port modules to Python RAG:

| This repo (TS)                         | Python analogue        |
|----------------------------------------|------------------------|
| `lib/domains/domain_detector.ts`       | `domains/detector.py`  |
| `lib/domains/legal/*`                  | `domains/legal/*`      |
| `lib/domains/healthcare/*`             | `domains/healthcare/*` |
| `collection` metadata                  | ChromaDB collection    |
| `lib/pinecone.ts`                      | Chroma client          |
| `/api/query`                           | FastAPI route          |

---

## 7. OCR

Set in `.env.local`:

```
ENABLE_PDF_OCR=true
OPENROUTER_OCR_MODEL=openai/gpt-4o-mini
```

When PDF text extraction yields &lt; 50 characters (scanned docs), vision OCR runs on up to 4 pages.

---

## 8. Dashboard analytics

`/dashboard/analytics` shows per-domain cards:

- Query count  
- Average confidence  
- Average latency  
- Hallucination rate  
- PASS / REWRITE / BLOCK counts  
