import { upsertDocs } from "@/lib/pinecone"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { docs } = await req.json()

    if (!Array.isArray(docs) || docs.length === 0) {
      return NextResponse.json({ error: "docs array is required" }, { status: 400 })
    }

    await upsertDocs(docs)
    return NextResponse.json({ success: true, count: docs.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
