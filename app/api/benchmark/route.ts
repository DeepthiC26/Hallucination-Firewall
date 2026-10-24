import { NextResponse } from "next/server"
import { runBenchmarkEvaluation } from "@/lib/benchmark/evaluation"

export async function GET() {
  try {
    const report = await runBenchmarkEvaluation()
    return NextResponse.json(report)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Benchmark failed" },
      { status: 500 }
    )
  }
}
