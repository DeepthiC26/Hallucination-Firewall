import { NextResponse } from "next/server"
import { getAllDocs, removeDoc } from "@/lib/doc-registry"
import { index } from "@/lib/pinecone"

// GET — return all registered docs
export async function GET() {
  const docs = getAllDocs()
  return NextResponse.json(docs)
}

// DELETE — remove a doc's vectors from Pinecone + registry
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const removed = removeDoc(id)
    if (!removed) {
      return NextResponse.json({ error: "Doc not found" }, { status: 404 })
    }

    // Delete from Pinecone — preloaded docs use simple IDs, uploaded docs use chunk IDs
    if (removed.vectorIds.length > 0) {
      // Pinecone deleteMany accepts up to 1000 IDs per call
      for (let i = 0; i < removed.vectorIds.length; i += 1000) {
        await index.deleteMany(removed.vectorIds.slice(i, i + 1000))
      }
    }

    return NextResponse.json({ ok: true, removed })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
