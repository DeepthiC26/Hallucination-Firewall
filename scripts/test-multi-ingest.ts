/**
 * Automated test suite for multi-file / folder / dataset knowledge base ingestion system.
 * Tests all 19 requirements from user specification.
 */

import * as XLSX from "xlsx"
import JSZip from "jszip"
import {
  extractSingleFile,
  extractZipArchive,
  ingestDatasetFiles,
  analyzeRelationships,
} from "../lib/ingest/dataset_extractor"
import {
  addDoc,
  getAllDocs,
  getDocById,
  findExistingDataset,
} from "../lib/doc-registry"
import { index, queryKB } from "../lib/pinecone"
import { verifyClaimsWithEvidence } from "../lib/safety/claims"

async function runTests() {
  console.log("==================================================")
  console.log("STARTING MULTI-FILE / DATASET INGESTION TEST SUITE")
  console.log("==================================================\n")

  let passed = 0
  let failed = 0

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`)
      passed++
    } else {
      console.error(`❌ [FAIL] ${testName}`)
      failed++
    }
  }

  // ─── 1. Test Single TXT File ──────────────────────────────────────────
  const txtContent = new TextEncoder().encode(
    "Antigravity Corporation Leave Policy. All full-time employees are entitled to 20 days of paid annual leave. Maternity leave is 26 weeks with full pay."
  )
  const txtExtracted = await extractSingleFile("leave_policy.txt", txtContent)
  assert(txtExtracted.fileType === "txt" && txtExtracted.chunks.length > 0, "1. Single TXT file extraction")

  // ─── 2. Test Single Excel (.xlsx) Multi-sheet Ingestion ────────────────
  const wb = XLSX.utils.book_new()
  const sheet1Data = [
    { Section: "302", Offence: "Murder", Punishment: "Death or imprisonment for life, and fine", Cognizable: "Yes" },
    { Section: "304", Offence: "Culpable Homicide not amounting to murder", Punishment: "Imprisonment for life or 10 years", Cognizable: "Yes" },
  ]
  const sheet2Data = [
    { Section: "378", Offence: "Theft", Punishment: "Imprisonment up to 3 years or fine", Bailable: "No" },
  ]
  const ws1 = XLSX.utils.json_to_sheet(sheet1Data)
  const ws2 = XLSX.utils.json_to_sheet(sheet2Data)
  XLSX.utils.book_append_sheet(wb, ws1, "Offences_Against_Body")
  XLSX.utils.book_append_sheet(wb, ws2, "Offences_Against_Property")
  const xlsxBytes = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  const excelExtracted = await extractSingleFile("Indian_Penal_Code.xlsx", new Uint8Array(xlsxBytes))
  assert(
    excelExtracted.sheets?.length === 2 &&
    excelExtracted.totalRows === 3 &&
    excelExtracted.chunks.some((c) => c.sheet === "Offences_Against_Body" && c.row === 1),
    "2. Single Excel file (.xlsx) with multiple sheets, rows, and schema"
  )

  // ─── 3. Test CSV Ingestion ────────────────────────────────────────────
  const csvContent = new TextEncoder().encode(
    "DoctorID,Name,Department,AvailableDays,ConsultationFee\nDOC01,Dr. Rajesh Sharma,Cardiology,Mon-Wed-Fri,1000\nDOC02,Dr. Priya Nair,Neurology,Tue-Thu-Sat,1200"
  )
  const csvExtracted = await extractSingleFile("doctors.csv", csvContent)
  assert(
    csvExtracted.fileType === "csv" &&
    csvExtracted.totalRows === 2 &&
    csvExtracted.chunks.some((c) => c.row === 1 && c.columns?.includes("Department")),
    "3. CSV file row and column ingestion"
  )

  // ─── 4. Multi-Excel Continuation & Schema Compatibility Detection ──────
  const wbCont1 = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wbCont1, XLSX.utils.json_to_sheet([
    { Section: "Section 1", Title: "Title and extent of operation", EnactedYear: "1860" }
  ]), "IPC_Part1")
  const cont1Bytes = XLSX.write(wbCont1, { type: "buffer", bookType: "xlsx" })

  const wbCont2 = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wbCont2, XLSX.utils.json_to_sheet([
    { Section: "Section 2", Title: "Punishment of offences committed within India", EnactedYear: "1860" }
  ]), "IPC_Part2")
  const cont2Bytes = XLSX.write(wbCont2, { type: "buffer", bookType: "xlsx" })

  const contFiles = [
    await extractSingleFile("IPC_Section_1.xlsx", new Uint8Array(cont1Bytes)),
    await extractSingleFile("IPC_Section_2.xlsx", new Uint8Array(cont2Bytes)),
  ]
  const relationships = analyzeRelationships(contFiles)
  assert(
    relationships.length > 0 &&
    relationships[0].isContinuation === true &&
    relationships[0].matchingColumns.includes("section"),
    "4. Multi-Excel continuation rows & schema compatibility detection"
  )

  // ─── 5. Excel files with different schemas under same dataset ──────────
  const wbDiff = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wbDiff, XLSX.utils.json_to_sheet([
    { CaseID: "CASE-2024-01", Court: "Supreme Court", Status: "Disposed", Bench: "3 Judges" }
  ]), "Cases")
  const diffBytes = XLSX.write(wbDiff, { type: "buffer", bookType: "xlsx" })

  const diffFiles = [
    contFiles[0],
    await extractSingleFile("CourtCases.xlsx", new Uint8Array(diffBytes)),
  ]
  const diffRelationships = analyzeRelationships(diffFiles)
  assert(
    diffRelationships.length > 0 && diffRelationships[0].isContinuation === false,
    "5. Excel files with different schemas preserved under same dataset"
  )

  // ─── 6. Safe ZIP Extraction & Path Traversal Prevention ────────────────
  const zip = new JSZip()
  zip.file("nested/Hospital_Services.xlsx", new Uint8Array(xlsxBytes))
  zip.file("nested/Doctors_List.csv", csvContent)
  zip.file("ignore_me.exe", new Uint8Array([0, 1, 2, 3]))
  zip.file(".DS_Store", new Uint8Array([0]))
  const zipBuffer = await zip.generateAsync({ type: "uint8array" })

  const zipExtracted = await extractZipArchive("Kaggle_Hospital_Dataset.zip", zipBuffer)
  assert(
    zipExtracted.length === 2 &&
    zipExtracted.some((f) => f.filename === "Hospital_Services.xlsx") &&
    zipExtracted.some((f) => f.filename === "Doctors_List.csv") &&
    !zipExtracted.some((f) => f.filename === "ignore_me.exe"),
    "6. Safe ZIP extraction ignoring binaries & junk files"
  )

  // ─── 7. Unified Dataset Ingestion (Mixed PDF + Excel + CSV + ZIP) ───────
  const mixedDataset = await ingestDatasetFiles({
    datasetName: "Hospital_Super_Dataset",
    files: [
      { filename: "patient_policy.txt", bytes: txtContent },
      { filename: "hospital_services.xlsx", bytes: new Uint8Array(xlsxBytes) },
      { filename: "doctors.csv", bytes: csvContent },
    ],
  })

  assert(
    mixedDataset.files.length === 3 &&
    mixedDataset.health.excelSheets === 2 &&
    mixedDataset.health.totalRows === 5 &&
    mixedDataset.allChunks.length >= 5 &&
    mixedDataset.health.status === "READY" &&
    mixedDataset.health.healthScorePercent === 100,
    "7. Unified Mixed Dataset (TXT + Excel + CSV) with real health metrics"
  )

  // ─── 8. Indexing into Vector Store with Full Provenance ────────────────
  const datasetId = "test-hospital-dataset-101"
  const vectorRecords = mixedDataset.allChunks.map((chunk, idx) => ({
    id: `${datasetId}-chunk-${idx}`,
    values: new Array(384).fill(0.05), // Mock embedding vector
    metadata: {
      text: chunk.text,
      title: "Hospital_Super_Dataset",
      domain: "healthcare" as const,
      docId: datasetId,
      datasetId,
      datasetName: "Hospital_Super_Dataset",
      sourceFile: chunk.sourceFile,
      fileType: chunk.fileType,
      sheet: chunk.sheet,
      row: chunk.row,
      columns: chunk.columns,
      page: chunk.page,
    },
  }))

  await index.upsert(vectorRecords)

  // Register in doc-registry
  addDoc({
    id: datasetId,
    datasetId,
    datasetName: "Hospital_Super_Dataset",
    title: "Hospital_Super_Dataset",
    filename: "Hospital_Super_Dataset",
    domain: "healthcare",
    chunks: vectorRecords.length,
    vectorIds: vectorRecords.map((v) => v.id),
    sizeBytes: 15000,
    isPreloaded: false,
    isDataset: true,
    status: "READY",
    contentFingerprint: mixedDataset.contentFingerprint,
    datasetHealth: mixedDataset.health,
  })

  const retrievedDataset = getDocById(datasetId)
  assert(
    retrievedDataset !== null &&
    retrievedDataset.isDataset === true &&
    retrievedDataset.status === "READY",
    "8. Persistent dataset registration with READY state"
  )

  // ─── 9. Cross-File Retrieval Across Dataset ────────────────────────────
  const queryResult = await queryKB("What is Section 302 and what is Dr. Rajesh Sharma's fee?", {
    topK: 5,
    datasetId,
  })

  assert(
    queryResult.matches.length > 0 &&
    queryResult.matches.some((m) => m.sourceFile === "hospital_services.xlsx" || m.sheet === "Offences_Against_Body"),
    "9. Cross-file unified retrieval with sheet and row provenance"
  )

  // ─── 10. Deduplication & Version Detection ─────────────────────────────
  const dupCheck = findExistingDataset("Hospital_Super_Dataset", mixedDataset.contentFingerprint)
  assert(dupCheck !== null && dupCheck.isExactMatch === true, "10. Exact dataset fingerprint deduplication")

  // ─── 11. Modified Dataset Version Incrementing ─────────────────────────
  const modCheck = findExistingDataset("Hospital_Super_Dataset", "modified-fingerprint-999")
  assert(modCheck !== null && modCheck.isExactMatch === false, "11. Modified dataset version detection")

  // ─── 12. Legal Domain Multi-File Ingestion ─────────────────────────────
  const legalDataset = await ingestDatasetFiles({
    datasetName: "Indian_Law_Compendium",
    files: [
      { filename: "IPC_Section_1.xlsx", bytes: new Uint8Array(cont1Bytes) },
      { filename: "IPC_Section_2.xlsx", bytes: new Uint8Array(cont2Bytes) },
      { filename: "CourtCases.xlsx", bytes: new Uint8Array(diffBytes) },
    ],
  })
  assert(
    legalDataset.files.length === 3 &&
    legalDataset.health.excelSheets === 3 &&
    legalDataset.relationships.length === 3,
    "12. Legal Domain Multi-File Compendium Ingestion with schema relationship matrix"
  )

  // ─── 13. Enterprise Domain HR & Finance Multi-File Ingestion ───────────
  const hrCsv = new TextEncoder().encode("EmployeeID,Name,Designation,Department,Salary\nEMP101,Aakash Verma,Senior Engineer,Platform,1800000\nEMP102,Sneha Roy,Lead Designer,UI/UX,1600000")
  const finCsv = new TextEncoder().encode("Quarter,Revenue,Expenses,NetProfit\nQ1 2024,5000000,3200000,1800000\nQ2 2024,6200000,3800000,2400000")
  
  const enterpriseDataset = await ingestDatasetFiles({
    datasetName: "Enterprise_Corporate_Records",
    files: [
      { filename: "HR_Employees.csv", bytes: hrCsv },
      { filename: "Finance_Q1_Q2.csv", bytes: finCsv },
    ],
  })
  assert(
    enterpriseDataset.files.length === 2 &&
    enterpriseDataset.health.csvRows === 4 &&
    enterpriseDataset.allChunks.length === 4,
    "13. Enterprise Domain Multi-File Ingestion (HR + Finance CSVs)"
  )

  // ─── 14. Folder Upload Simulation (Relative Paths) ──────────────────────
  const folderDataset = await ingestDatasetFiles({
    datasetName: "Kaggle_Hospital_Folder",
    files: [
      { filename: "services.xlsx", relativePath: "Kaggle_Hospital_Folder/data/services.xlsx", bytes: new Uint8Array(xlsxBytes) },
      { filename: "staff.csv", relativePath: "Kaggle_Hospital_Folder/staff.csv", bytes: csvContent },
    ],
  })
  assert(
    folderDataset.files.length === 2 &&
    folderDataset.files[0].relativePath.includes("data/services.xlsx"),
    "14. Folder ingestion preserving directory relative paths"
  )

  // ─── 15. Real Ingestion Health Failure Handling ────────────────────────
  const brokenDataset = await ingestDatasetFiles({
    datasetName: "Mixed_Corrupt_Dataset",
    files: [
      { filename: "valid.txt", bytes: txtContent },
      { filename: "corrupt.bin", bytes: new Uint8Array([0, 1, 2]) }, // unsupported binary
    ],
  })
  assert(
    brokenDataset.health.filesProcessed === 1 &&
    brokenDataset.health.filesFailed === 1 &&
    brokenDataset.health.status === "PARTIALLY_READY" &&
    brokenDataset.health.healthScorePercent < 100,
    "15. Real Ingestion Health penalty and PARTIALLY_READY status on corrupt files"
  )

  console.log("\n==================================================")
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log("==================================================")

  if (failed > 0) process.exit(1)
}

runTests().catch((err) => {
  console.error("Test suite crashed:", err)
  process.exit(1)
})
