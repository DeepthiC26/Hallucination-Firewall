import { NextResponse } from "next/server"
import { getAvailableProviders } from "@/lib/llm"

export async function GET() {
  const providers = getAvailableProviders()
  const data = await Promise.all(providers.map(async (p) => {
    return {
      id: p.id,
      name: p.name,
      models: await p.getModels()
    }
  }))
  return NextResponse.json(data)
}
