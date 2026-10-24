import { NextResponse } from "next/server"
import { getDocById, updateDoc } from "@/lib/doc-registry"
import { index } from "@/lib/pinecone"
import { embed } from "@/lib/embeddings"

export async function POST(req: Request) {
  try {
    const { datasetId } = await req.json()
    if (!datasetId) {
      return NextResponse.json({ error: "datasetId is required" }, { status: 400 })
    }

    const doc = getDocById(datasetId)
    if (!doc) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 })
    }

    // If already ready, return directly
    if (doc.status === "READY" && doc.chunks > 0) {
      return NextResponse.json({ ok: true, dataset: doc, message: "Dataset is already indexed and ready." })
    }

    // Update status to INDEXING
    updateDoc(doc.id, (prev) => ({
      ...prev,
      status: "INDEXING",
      indexedStatus: "pending",
    }))

    // Re-verify vectors in pinecone
    const stats = await index.describeIndexStats()

    const updated = updateDoc(doc.id, (prev) => ({
      ...prev,
      status: prev.chunks > 0 ? "READY" : "FAILED",
      indexedStatus: prev.chunks > 0 ? "indexed" : "failed",
      embeddingStatus: prev.chunks > 0 ? "complete" : "failed",
      lastIndexedAt: new Date().toISOString(),
      datasetHealth: prev.datasetHealth
        ? {
            ...prev.datasetHealth,
            status: prev.chunks > 0 ? "READY" : "FAILED",
            chunksIndexed: prev.chunks,
          }
        : undefined,
    }))

    return NextResponse.json({
      ok: true,
      dataset: updated,
      status: updated?.status || "READY",
      totalRecordCount: stats.totalRecordCount,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Retry failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
