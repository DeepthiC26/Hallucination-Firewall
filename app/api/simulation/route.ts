import { NextResponse } from "next/server"
import {
  getSimulationAggregate,
  getSimulationEvaluations,
  SIMULATION_CATEGORIES,
  simulationCategoryLabel,
} from "@/lib/hallucination-simulation"

export async function GET() {
  try {
    const aggregate = getSimulationAggregate()
    const evaluations = getSimulationEvaluations(40)
    return NextResponse.json({
      aggregate,
      evaluations,
      categories: SIMULATION_CATEGORIES.map((c) => ({
        id: c,
        label: simulationCategoryLabel(c),
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Simulation API failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
