import { NextResponse } from "next/server"
import { discoverKnowledgeGaps } from "@/lib/trust-os/knowledge_gaps"
import { getAuditLogAll } from "@/lib/audit-log"

export async function GET() {
  const recent = getAuditLogAll(50)
  const gaps = discoverKnowledgeGaps({
    query: recent[0]?.query || "policy",
    missingEvidence: true,
  })
  // Aggregate from recent blocks
  const more = recent
    .filter((e) => e.decision === "block" || e.failureClass === "missing_evidence")
    .slice(0, 5)
    .flatMap((e) =>
      discoverKnowledgeGaps({ query: e.query, missingEvidence: true })
    )
  const seen = new Set<string>()
  const merged = [...gaps, ...more].filter((g) => {
    if (seen.has(g.topic)) return false
    seen.add(g.topic)
    return true
  })
  return NextResponse.json({ gaps: merged })
}
