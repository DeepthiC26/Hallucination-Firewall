/**
 * Seed KB API route — auto-uploads seed chunks for a given domain
 * if that domain collection is empty (or on demand).
 *
 * POST /api/seed-kb
 * Body: { domain: "healthcare" | "legal" | "enterprise" | "all" }
 *
 * GET /api/seed-kb
 * Returns KB status per domain.
 */

import { index, upsertDocs } from "@/lib/pinecone"
import { HOSPITAL_SEED_CHUNKS } from "@/lib/seed-kb/hospital-seed"
import { LEGAL_SEED_CHUNKS } from "@/lib/seed-kb/legal-seed"
import { ENTERPRISE_SEED_CHUNKS } from "@/lib/seed-kb/enterprise-seed"
import type { Domain } from "@/types"

async function getDomainCount(collection: string): Promise<number> {
  try {
    const stats = await index.describeIndexStats()
    return (stats.byCollection as Record<string, number>)[collection] ?? 0
  } catch {
    return 0
  }
}

async function seedDomain(domain: "healthcare" | "legal" | "enterprise") {
  const chunks =
    domain === "healthcare"
      ? HOSPITAL_SEED_CHUNKS
      : domain === "legal"
        ? LEGAL_SEED_CHUNKS
        : ENTERPRISE_SEED_CHUNKS

  await upsertDocs(
    chunks.map((c) => ({
      id: c.id,
      title: c.title,
      domain: c.domain as Domain,
      text: c.text,
    }))
  )

  return chunks.length
}

export async function GET() {
  const [hcCount, lgCount, entCount] = await Promise.all([
    getDomainCount("healthcare_kb"),
    getDomainCount("legal_kb"),
    getDomainCount("enterprise_kb"),
  ])

  return Response.json({
    healthcare: { count: hcCount, seeded: hcCount > 0 },
    legal: { count: lgCount, seeded: lgCount > 0 },
    enterprise: { count: entCount, seeded: entCount > 0 },
  })
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    domain?: string
    force?: boolean
  }

  const domains: Array<"healthcare" | "legal" | "enterprise"> =
    !body.domain || body.domain === "all"
      ? ["healthcare", "legal", "enterprise"]
      : body.domain === "healthcare" || body.domain === "legal" || body.domain === "enterprise"
        ? [body.domain]
        : []

  if (domains.length === 0) {
    return Response.json({ error: "Invalid domain" }, { status: 400 })
  }

  const results: Record<string, { seeded: boolean; chunks: number; skipped?: boolean }> = {}

  for (const domain of domains) {
    const collection = `${domain}_kb`
    const existing = await getDomainCount(collection)

    // Skip if already seeded and not forced
    if (existing > 0 && !body.force) {
      results[domain] = { seeded: true, chunks: existing, skipped: true }
      continue
    }

    const count = await seedDomain(domain)
    results[domain] = { seeded: true, chunks: count }
  }

  return Response.json({ success: true, results })
}
