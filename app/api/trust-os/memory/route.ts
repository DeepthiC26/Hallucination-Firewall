import { NextResponse } from "next/server"
import { getHallucinationMemory } from "@/lib/trust-os/memory"

export async function GET() {
  return NextResponse.json({ entries: getHallucinationMemory(200) })
}
