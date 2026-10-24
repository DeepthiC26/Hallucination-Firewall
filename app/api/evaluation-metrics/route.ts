import { NextResponse } from "next/server"
import { getEvaluationMetrics, readEvaluations } from "@/lib/evaluation_engine"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const domain = searchParams.get("domain") || undefined
  
  const metrics = getEvaluationMetrics(domain)
  
  let cases = readEvaluations()
  if (domain && domain !== 'all') {
    cases = cases.filter(r => r.testCase.domain === domain)
  }
  
  return NextResponse.json({
    metrics,
    cases
  })
}
