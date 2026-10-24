import { NextResponse } from "next/server"
import {
  buildOrganisationalLearningDashboard,
  buildInvestigationReplay,
  getInvestigationMemory,
  getPatternLibrary,
} from "@/lib/adaptive-memory"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const replayId = searchParams.get("replay")
    if (replayId) {
      const replay = buildInvestigationReplay(replayId)
      if (!replay) {
        return NextResponse.json({ error: "Investigation not found" }, { status: 404 })
      }
      return NextResponse.json(replay)
    }

    const dashboard = buildOrganisationalLearningDashboard()
    const investigations = getInvestigationMemory(80)
    const patterns = getPatternLibrary(40)
    return NextResponse.json({ dashboard, investigations, patterns })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Adaptive memory failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
