import { NextResponse } from "next/server"
import { getLLMConfig, saveLLMConfig } from "@/lib/llm"

export async function GET() {
  return NextResponse.json(getLLMConfig())
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const updated = saveLLMConfig({
      defaultProvider: body.defaultProvider,
      defaultModel: body.defaultModel
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
