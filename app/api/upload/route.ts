import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { embed } from "@/lib/embeddings"
import { index } from "@/lib/pinecone"
import {
  addDoc,
  findExistingDataset,
  type DocRegistryEntry,
  type DatasetSourceFile,
} from "@/lib/doc-registry"
import { detectDomain } from "@/lib/domains/domain_detector"
import { collectionFor } from "@/lib/domains/kb_collections"
import {
  detectExtension,
  ingestDatasetFiles,
  type DatasetExtractionResult,
} from "@/lib/ingest/dataset_extractor"
import { runKnowledgeIntelligence } from "@/lib/knowledge-intelligence"
import { runTrustGovernanceIntelligence } from "@/lib/trust-governance"
import type { Domain } from "@/types"

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const rawFiles = formData.getAll("files") as File[]
    const singleFile = formData.get("file") as File | null
    const filesToProcess = rawFiles.length > 0 ? rawFiles : singleFile ? [singleFile] : []
    const hintedDomain = (formData.get("domain") as Domain) || "enterprise"
    let datasetName = (formData.get("datasetName") as string) || ""

    if (filesToProcess.length === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!datasetName) {
      if (filesToProcess.length === 1) {
        datasetName = filesToProcess[0].name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")
      } else {
        datasetName = `Dataset_${new Date().toISOString().slice(0, 10)}`
      }
    }

    const inputFiles: Array<{ filename: string; relativePath?: string; bytes: Uint8Array }> = []
    let totalSizeBytes = 0

    for (const file of filesToProcess) {
      totalSizeBytes += file.size
      const arrayBuffer = await file.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      const relativePath = (file as any).webkitRelativePath || file.name
      inputFiles.push({
        filename: file.name,
        relativePath,
        bytes,
      })
    }

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
          embeddingStatus: "failed",
          indexedStatus: "failed",
          investigationStatus: "failed",
          status: "FAILED",
        },
        { status: 422 }
      )
    }

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
          message: "Document is already indexed and up-to-date (identical content).",
          doc: existing.doc,
          dataset: existing.doc,
          health: existing.doc.datasetHealth || extracted.health,
          status: "READY",
          duplicateDetected: true,
          continueTo: "/dashboard/verify",
        })
      }
      version = (existing.doc.version || 1) + 1
      datasetId = existing.doc.datasetId || existing.doc.id
    }

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

    for (let i = 0; i < vectorRecords.length; i += 50) {
      await index.upsert(vectorRecords.slice(i, i + 50))
    }

    // VERIFY INDEX: Ensure the newly inserted dataset is retrievable
    if (vectorRecords.length > 0) {
      let isRetrievable = false
      for (let retries = 0; retries < 3; retries++) {
        const testRes = await index.query({
          vector: vectorRecords[0].values,
          topK: 1,
          filter: { datasetId: { $eq: datasetId } }
        })
        if (testRes.matches && testRes.matches.length > 0) {
          isRetrievable = true
          break
        }
        await new Promise((r) => setTimeout(r, 500))
      }
      if (!isRetrievable) {
        console.warn(`Vector index did not immediately reflect the new dataset ${datasetId}`)
      }
    }

    extracted.health.chunksIndexed = vectorRecords.length
    extracted.health.status =
      extracted.health.filesFailed > 0 && extracted.health.filesProcessed > 0
        ? "PARTIALLY_READY"
        : "READY"

    const entry: DocRegistryEntry = addDoc({
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
      pages: extracted.health.pdfPages || (primaryFile.pages ?? 1),
      fileType: extracted.files.length === 1 ? primaryFile.fileType : "dataset",
      embeddingStatus: "complete",
      indexedStatus: "indexed",
      firewallDomain: detection.firewallDomain,
      knowledgeHealth,
      contentFingerprint: extracted.contentFingerprint,
      knowledgePreview: sampleText.slice(0, 6000),
      investigationStatus: "complete",
      isDataset: extracted.files.length > 1 || Boolean(formData.get("datasetName")),
      version,
      sourceFiles: sourceFilesMeta,
      datasetHealth: extracted.health,
      status: extracted.health.status,
      relationshipSummary: extracted.health.relationshipSummary,
    })

    runTrustGovernanceIntelligence({
      recordSnapshot: true,
      domain: detection.firewallDomain,
      drivers: [
        knowledgeHealth.trustForVerification
          ? `Verified knowledge upload ("${datasetName}") improved knowledge health`
          : `Document "${datasetName}" indexed with knowledge warnings`,
        `Authority ${knowledgeHealth.authorityLevel}`,
        `Index decision: ${knowledgeHealth.indexDecision}`,
      ],
    })

    return NextResponse.json({
      ok: true,
      doc: entry,
      dataset: entry,
      sourceFiles: sourceFilesMeta,
      health: extracted.health,
      relationships: extracted.relationships,
      chunksIngested: vectorRecords.length,
      pages: extracted.health.pdfPages,
      embeddingStatus: "complete",
      indexedStatus: "indexed",
      investigationStatus: "complete",
      knowledgeHealth,
      usedOcr: extracted.files.some((f) => f.usedOcr),
      warning: extracted.health.extractionErrors[0],
      domainDetection: {
        firewallDomain: detection.firewallDomain,
        confidence: detection.confidence,
        reason: detection.reason,
        collection,
      },
      status: extracted.health.status,
      continueTo: "/dashboard/verify",
    })
  } catch (err) {
    console.error("Upload error:", err)
    const message = err instanceof Error ? err.message : "Upload failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const maxDuration = 120
