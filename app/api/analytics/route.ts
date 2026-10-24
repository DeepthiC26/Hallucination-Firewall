import { getAuditLogAll } from "@/lib/audit-log"
import { computeAnalytics } from "@/lib/analytics"
import { getAllDocs } from "@/lib/doc-registry"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const docId = searchParams.get("docId")
  const domain = searchParams.get("domain")
  const entries = getAuditLogAll(500)
  const analytics = computeAnalytics(entries, docId, domain)
  const docs = getAllDocs().map((d) => ({
    id: d.id,
    title: d.title,
    filename: d.filename,
    domain: d.domain,
    chunks: d.chunks,
  }))
  return NextResponse.json({ ...analytics, docs })
}
