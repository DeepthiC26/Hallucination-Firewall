import { NextResponse } from "next/server"
import { runTrustGovernanceIntelligence } from "@/lib/trust-governance"

export async function GET() {
  try {
    const report = runTrustGovernanceIntelligence()
    return NextResponse.json(report)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Trust governance failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
