import { NextResponse } from "next/server"
import { analyzeDocumentHealth } from "@/lib/safety/document_health"

export async function GET() {
  try {
    const report = analyzeDocumentHealth()
    return NextResponse.json(report)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Health check failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
