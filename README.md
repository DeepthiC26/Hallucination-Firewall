# 🛡 Hallucination Firewall

A real-time LLM hallucination detection and prevention system for enterprise AI. Every LLM response is fact-checked against a verified knowledge base before reaching users — with live animated pipeline visualization.

## Architecture

```
User Query
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                   Next.js 14 App Router                     │
│                                                             │
│  POST /api/query  ──────────────────────────────────────►  │
│         │                                           SSE     │
│         ▼                                           Stream  │
│  [1] OpenRouter LLM (stepfun-ai/step-3.5)                   │
│         │  raw response                                      │
│         ▼                                                   │
│  [2] Split into sentences                                   │
│         │                                                   │
│         ▼                                                   │
│  [3] Embed each sentence (OpenAI ada-002)                   │
│         │                                                   │
│         ▼                                                   │
│  [4] Query Pinecone KB ──► cosine similarity scores        │
│         │  score > 0.82 = safe                              │
│         │  score 0.65-0.82 = uncertain                      │
│         │  score < 0.65 = hallucinated                      │
│         ▼                                                   │
│  [5] scoreConfidence() = factScore×0.7 - halluciRatio×0.3  │
│         │                                                   │
│         ▼                                                   │
│  [6] makeDecision() with domain-specific thresholds        │
│         │  finance: block < 0.55, rewrite < 0.72           │
│         │  legal:   block < 0.50, rewrite < 0.68           │
│         │  hr/gen:  block < 0.40, rewrite < 0.65           │
│         ▼                                                   │
│  [7] BLOCK → suppress │ REWRITE → LLM rewrite │ PASS → OK  │
│                                                             │
│  [8] Persist to audit log (memory + JSON file)             │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
   Pinecone Index
   (1536-dim cosine)
   15 enterprise docs:
   - 5 Legal policies
   - 5 HR policies
   - 5 Finance reports
```

## Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- [Pinecone account](https://pinecone.io) (free tier is sufficient)
- [OpenRouter account](https://openrouter.ai) (for `stepfun-ai/step-3.5`)

**No OpenAI key needed.** Embeddings run 100% locally using `Xenova/all-MiniLM-L6-v2` via `@huggingface/transformers`. The model (~90MB) downloads automatically on first run.

## Getting API Keys

### Pinecone
1. Sign up at [pinecone.io](https://pinecone.io)
2. Create a project (free tier works)
3. Copy your API key from the dashboard
4. The index will be created automatically on first run (dimension: 384, metric: cosine)

### OpenRouter
1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Go to Keys → Create a key
3. Fund with a small amount (queries cost fractions of a cent)

### Embeddings — completely free
Uses `Xenova/all-MiniLM-L6-v2` via `@huggingface/transformers` — runs locally in Node.js. No API key, no cost, no rate limits. Model is ~90MB and cached in `.hf-cache/` on first run.

## Setup

```bash
# 1. Clone / navigate to project
cd hallucination-firewall

# 2. Install dependencies
pnpm install

# 3. Fill in API keys (only 2 needed!)
cp .env.example .env.local
# Edit .env.local — add OPENROUTER_API_KEY and PINECONE_API_KEY

# 4. Run the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on the landing page.

- Click **Get Started** → `/signup` → fills any values → redirects to `/dashboard`
- Or **Sign In** → `/signin` → fills any values → redirects to `/dashboard`

On first run, the system will automatically:
- Download the MiniLM embedding model (~90MB, cached in `.hf-cache/`)
- Create the Pinecone index (dimension: 384, metric: cosine)
- Embed and upsert all 15 enterprise knowledge base documents
- Log: "Knowledge base seeded with 15 documents across legal, HR, finance domains"

## 3 Demo Scenarios (show these to judges)

### 🟡 Scenario 1: REWRITE — Data Retention (Legal)
**Query:** `What is our data retention period?`  
**Domain:** Legal  
**What happens:** LLM says "3 years" but KB says 7 years. The "3 years" sentence scores 0.18 in Pinecone (hallucinated). The system rewrites the response with the correct 7-year figure, citing "Data Retention Policy".

### 🟢 Scenario 2: PASS — PTO Days (HR)
**Query:** `How many PTO days do senior employees get?`  
**Domain:** HR  
**What happens:** LLM correctly states 20 days. All sentences score above 0.82 against the HR PTO Policy document. Confidence gauge animates to ~88%. Green PASSED badge.

### 🔴 Scenario 3: BLOCK — Q3 Revenue (Finance)
**Query:** `What was Q3 2024 revenue?`  
**Domain:** Finance  
**What happens:** LLM says "$6.8 million" but KB says $4.2M. Finance domain has strict thresholds. Full pipeline turns red, BLOCKED banner appears with: "Financial data mismatch detected — serving unverified financial figures poses compliance risk."

## Project Structure

```
hallucination-firewall/
├── app/
│   ├── page.tsx                  # Main 3-column demo UI
│   ├── layout.tsx
│   ├── globals.css               # JetBrains Mono + DM Sans
│   └── api/
│       ├── query/route.ts        # SSE streaming pipeline
│       ├── audit-log/route.ts    # GET last 50 decisions
│       ├── kb-status/route.ts    # GET KB vector count
│       └── ingest/route.ts       # POST add docs
├── components/
│   ├── QueryInput.tsx            # Query textarea + domain + presets
│   ├── FirewallPipeline.tsx      # 5-stage animated pipeline
│   ├── ResponsePanel.tsx         # LLM + verified response
│   ├── AuditLog.tsx              # Expandable audit table
│   ├── ConfidenceGauge.tsx       # SVG semicircle gauge
│   └── SpanHighlighter.tsx       # Sentence-level highlights
├── lib/
│   ├── pinecone.ts               # Pinecone client + seed logic
│   ├── openrouter.ts             # LLM client (step-3.5)
│   ├── firewall.ts               # Core scoring logic
│   ├── rewriter.ts               # Context-grounded rewriter
│   ├── embeddings.ts             # ada-002 via OpenAI SDK
│   ├── audit-log.ts              # In-memory + JSON persistence
│   └── sample-docs.ts            # 15 enterprise KB docs
├── types/index.ts                # Shared TypeScript types
├── instrumentation.ts            # Auto-seed on server start
└── .env.local                    # API keys (not committed)
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend + API | Next.js 14 App Router |
| Styling | Tailwind CSS + Framer Motion |
| Vector DB | Pinecone (serverless, cosine, 384-dim) |
| LLM | OpenRouter → stepfun-ai/step-3.5 |
| Embeddings | `@huggingface/transformers` — Xenova/all-MiniLM-L6-v2 (**free, local**) |
| Language | TypeScript throughout |
| Package manager | pnpm |

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/signin` | Dummy sign-in → redirects to `/dashboard` |
| `/signup` | Dummy sign-up → redirects to `/dashboard` |
| `/dashboard` | The live firewall app (3-column layout) |
