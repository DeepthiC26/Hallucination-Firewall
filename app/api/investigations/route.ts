import { getInvestigationsFiltered } from "@/lib/investigation_record"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const domain = searchParams.get("domain") || undefined
  const datasetId = searchParams.get("datasetId") || undefined
  
  const records = getInvestigationsFiltered({ domain, datasetId })
  return NextResponse.json(records)
}
