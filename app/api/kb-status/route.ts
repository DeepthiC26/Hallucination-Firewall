import { index } from "@/lib/pinecone"
import { sampleDocs } from "@/lib/sample-docs"
import { toFirewallDomain } from "@/lib/domains/domain_detector"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const stats = await index.describeIndexStats()
    const byCollection =
      (stats as { byCollection?: Record<string, number> }).byCollection || {}

    return NextResponse.json({
      totalVectors: stats.totalRecordCount || 0,
      collections: byCollection,
      docs: sampleDocs.map((d) => ({
        id: d.id,
        domain: d.domain,
        firewallDomain: toFirewallDomain(d.domain),
        title: d.title,
      })),
      domains: {
        enterprise: sampleDocs.filter((d) => toFirewallDomain(d.domain) === "enterprise")
          .length,
        legal: sampleDocs.filter((d) => toFirewallDomain(d.domain) === "legal").length,
        healthcare: sampleDocs.filter((d) => toFirewallDomain(d.domain) === "healthcare")
          .length,
        legalLegacy: sampleDocs.filter((d) => d.domain === "legal").length,
        hr: sampleDocs.filter((d) => d.domain === "hr").length,
        finance: sampleDocs.filter((d) => d.domain === "finance").length,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get KB status"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
