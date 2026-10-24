import { NextResponse } from "next/server"
import { getProvider } from "@/lib/llm"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const provider = getProvider(body.provider)
    if (!provider) {
      return NextResponse.json({ error: "Provider not found or unavailable" }, { status: 400 })
    }

    const res = await provider.generate({
      systemPrompt: "You are a test assistant.",
      userPrompt: "Reply with the word 'SUCCESS'.",
      model: body.model,
      maxTokens: 10
    })

    return NextResponse.json({ success: true, text: res.text })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
