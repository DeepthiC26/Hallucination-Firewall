import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { embed } from "@/lib/embeddings"
import { index } from "@/lib/pinecone"
import {
  addDoc,
  getAllDocs,
  getAllDatasets,
  getDocById,
  removeDoc,
  findExistingDataset,
  type DocRegistryEntry,
  type DatasetSourceFile,
} from "@/lib/doc-registry"
import { detectDomain } from "@/lib/domains/domain_detector"
import { collectionFor } from "@/lib/domains/kb_collections"
import {
  ingestDatasetFiles,
  type DatasetExtractionResult,
} from "@/lib/ingest/dataset_extractor"
import { runKnowledgeIntelligence } from "@/lib/knowledge-intelligence"
import { runTrustGovernanceIntelligence } from "@/lib/trust-governance"
import type { Domain } from "@/types"

export async function GET() {
  const datasets = getAllDatasets()
  const allDocs = getAllDocs()
  return NextResponse.json({
    datasets,
    documents: allDocs,
    totalDatasets: datasets.length,
    totalDocuments: allDocs.length,
  })
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const rawFiles = formData.getAll("files") as File[]
    const singleFile = formData.get("file") as File | null
    const filesToProcess = rawFiles.length > 0 ? rawFiles : singleFile ? [singleFile] : []
    
    let datasetName = (formData.get("datasetName") as string) || ""
    const hintedDomain = (formData.get("domain") as Domain) || "enterprise"

    if (filesToProcess.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    // Default dataset name if not provided
    if (!datasetName) {
      if (filesToProcess.length === 1) {
        datasetName = filesToProcess[0].name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")
      } else {
        datasetName = `Dataset_${new Date().toISOString().slice(0, 10)}`
      }
    }

    // Convert browser Files to Uint8Array with relativePath preservation
    const inputFiles: Array<{ filename: string; relativePath?: string; bytes: Uint8Array }> = []
    let totalSizeBytes = 0

    for (const file of filesToProcess) {
      totalSizeBytes += file.size
      const arrayBuffer = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      // WebkitRelativePath is available when uploaded as folder
      const relativePath = (file as any).webkitRelativePath || file.name
      inputFiles.push({
        filename: file.name,
        relativePath,
        bytes,
      })
    }

    // Extract, parse, and analyze relationships
    const extracted: DatasetExtractionResult = await ingestDatasetFiles({
      datasetName,
      files: inputFiles,
    })

    if (extracted.files.length === 0) {
      return NextResponse.json(
        {
          error:
            extracted.health.extractionErrors[0] ||
            "Could not extract any supported documents from upload.",
          health: extracted.health,
          status: "FAILED",
        },
        { status: 422 }
      )
    }

    // Detect domain from combined extracted text
    const sampleText = extracted.files.map((f) => f.text.slice(0, 3000)).join("\n\n")
    const detection = detectDomain({
      documentText: sampleText,
      filename: datasetName,
      hintedDomain,
    })
    const domain = detection.legacyDomain
    const collection = collectionFor(detection.firewallDomain)

    // Versioning / duplicate check
    const existing = findExistingDataset(datasetName, extracted.contentFingerprint)
    let version = 1
    let datasetId = uuidv4()

    if (existing) {
      if (existing.isExactMatch && existing.doc.status === "READY") {
        return NextResponse.json({
          ok: true,
          message: "Dataset is already indexed and up-to-date (identical content).",
          dataset: existing.doc,
          health: existing.doc.datasetHealth || extracted.health,
          status: "READY",
          duplicateDetected: true,
        })
      }
      version = (existing.doc.version || 1) + 1
      datasetId = existing.doc.datasetId || existing.doc.id
    }

    // Run Knowledge Health Intelligence across the dataset
    const primaryFile = extracted.files[0]
    const knowledgeHealth = runKnowledgeIntelligence({
      title: datasetName,
      filename: primaryFile.filename,
      text: sampleText,
      pages: extracted.health.pdfPages || extracted.files.length,
      sizeBytes: totalSizeBytes,
      firewallDomain: detection.firewallDomain,
      usedOcr: extracted.files.some((f) => f.usedOcr),
      warning: extracted.health.extractionErrors[0],
      excludeDocId: datasetId,
    })

    // Index all structured chunks into Pinecone vector store
    const chunks = extracted.allChunks
    const vectorRecords: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }> = []
    const sourceFilesMeta: DatasetSourceFile[] = []

    for (let fIdx = 0; fIdx < extracted.files.length; fIdx++) {
      const file = extracted.files[fIdx]
      const fileVectorIds: string[] = []
      const fileChunks = file.chunks

      for (let cIdx = 0; cIdx < fileChunks.length; cIdx++) {
        const chunk = fileChunks[cIdx]
        const vectorId = `${datasetId}-${fIdx}-chunk-${cIdx}`
        fileVectorIds.push(vectorId)

        const embedding = await embed(chunk.text)
        vectorRecords.push({
          id: vectorId,
          values: embedding,
          metadata: {
            text: chunk.text,
            title: datasetName,
            domain,
            docId: datasetId,
            datasetId,
            datasetName,
            sourceFile: chunk.sourceFile,
            fileType: chunk.fileType,
            sheet: chunk.sheet,
            row: chunk.row,
            columns: chunk.columns,
            columnValues: chunk.columnValues,
            page: chunk.page,
            section: chunk.section,
            docVersion: version,
            collection,
            firewallDomain: detection.firewallDomain,
            authorityLevel: knowledgeHealth.authorityLevel,
            knowledgeQuality: knowledgeHealth.overallQuality,
            knowledgeFreshness: knowledgeHealth.freshness,
            knowledgeTrust: knowledgeHealth.trustForVerification,
            knowledgeIndexDecision: knowledgeHealth.indexDecision,
            knowledgeConflict: knowledgeHealth.conflictStatus,
          },
        })
      }

      sourceFilesMeta.push({
        id: `${datasetId}-file-${fIdx}`,
        filename: file.filename,
        relativePath: file.relativePath,
        fileType: file.fileType,
        sizeBytes: file.sizeBytes,
        chunks: fileChunks.length,
        vectorIds: fileVectorIds,
        pages: file.pages,
        sheets: file.sheets,
        totalRows: file.totalRows,
        schema: file.schema,
        status: file.text ? "READY" : "FAILED",
        warning: file.warning,
      })
    }

    // Upsert vectors in batches
    for (let i = 0; i < vectorRecords.length; i += 50) {
      await index.upsert(vectorRecords.slice(i, i + 50))
    }

    extracted.health.chunksIndexed = vectorRecords.length
    extracted.health.status =
      extracted.health.filesFailed > 0 && extracted.health.filesProcessed > 0
        ? "PARTIALLY_READY"
        : "READY"

    // Register in doc-registry
    const datasetEntry: DocRegistryEntry = addDoc({
      id: datasetId,
      datasetId,
      datasetName,
      title: datasetName,
      filename: primaryFile.filename,
      domain,
      chunks: vectorRecords.length,
      vectorIds: vectorRecords.map((v) => v.id),
      sizeBytes: totalSizeBytes,
      isPreloaded: false,
      pages: extracted.health.pdfPages,
      fileType: extracted.files.length === 1 ? primaryFile.fileType : "dataset",
      embeddingStatus: "complete",
      indexedStatus: "indexed",
      firewallDomain: detection.firewallDomain,
      knowledgeHealth,
      contentFingerprint: extracted.contentFingerprint,
      knowledgePreview: sampleText.slice(0, 6000),
      investigationStatus: "complete",
      isDataset: true,
      version,
      sourceFiles: sourceFilesMeta,
      datasetHealth: extracted.health,
      status: extracted.health.status,
      relationshipSummary: extracted.health.relationshipSummary,
    })

    // Run Trust Governance event
    runTrustGovernanceIntelligence({
      recordSnapshot: true,
      domain: detection.firewallDomain,
      drivers: [
        `Dataset "${datasetName}" (${sourceFilesMeta.length} files, ${vectorRecords.length} chunks) indexed successfully`,
        `Authority ${knowledgeHealth.authorityLevel}`,
        `Index decision: ${knowledgeHealth.indexDecision}`,
      ],
    })

    return NextResponse.json({
      ok: true,
      dataset: datasetEntry,
      sourceFiles: sourceFilesMeta,
      health: extracted.health,
      relationships: extracted.relationships,
      chunksIngested: vectorRecords.length,
      status: extracted.health.status,
      continueTo: "/dashboard/verify",
    })
  } catch (err) {
    console.error("Dataset ingestion error:", err)
    const message = err instanceof Error ? err.message : "Dataset ingestion failed"
    return NextResponse.json({ error: message, status: "FAILED" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

    const removed = removeDoc(id)
    if (!removed) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 })
    }

    if (removed.vectorIds && removed.vectorIds.length > 0) {
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

export const maxDuration = 120
