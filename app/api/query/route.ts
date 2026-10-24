import { callGeneratorLLM } from "@/lib/openrouter"
import { runCrossVerifier, type CrossVerifierOpinion } from "@/lib/cross-verifier"
import {
  scoreConfidence,
  buildReason,
  buildBlockMessage,
} from "@/lib/firewall"

import { saveAuditEntry } from "@/lib/audit-log"
import { saveInvestigationRecord } from "@/lib/investigation_record"
import { queryKB } from "@/lib/pinecone"
import { getDocById, getEmbedDocId } from "@/lib/doc-registry"
import {
  detectPromptInjection,
  PROMPT_INJECTION_USER_MESSAGE,
} from "@/lib/prompt_security"
import { detectDocumentConflicts } from "@/lib/contradiction_detector"
import { buildConfidenceHeatmap } from "@/lib/confidence_heatmap"
import { buildDecisionExplanation } from "@/lib/explainable_ai"
import { detectDomain } from "@/lib/domains/domain_detector"
import { collectionFor } from "@/lib/domains/kb_collections"
import {
  applyDomainVerification,
  systemPromptForDomain,
} from "@/lib/domains/pipeline"
import {
  LatencyTracker,
  verifyStochasticConsistency,
  applyConsistencyPenalty,
  predictHallucinationRisk,
  assessDocumentFreshness,
  prioritizeFreshMatches,
  computeTrustScore,
  classifyFailure,
  buildEvidenceSnippets,
  enrichExplanationWithReliability,
} from "@/lib/reliability"
import type { ReliabilityReport } from "@/lib/reliability/types"
import { verifyClaimsWithEvidence, buildClaimObjects } from "@/lib/safety/claims"
import { buildSafetyPlatformReport } from "@/lib/safety/build_report"
import {
  runPredictiveStage,
  runTrustOperatingSystem,
} from "@/lib/trust-os/orchestrator"
import { recordVerificationTrustEvent } from "@/lib/trust-governance"
import {
  consultInvestigationMemory,
  learnFromInvestigation,
  applyAdaptiveMemoryEscalation,
} from "@/lib/adaptive-memory"
import {
  runInvestigationPipeline,
  buildInvestigationExplanation,
} from "@/lib/decision-validation"
import {
  injectHallucination,
  evaluateSimulation,
  type SimulationCategory,
  type SimulationEvaluation,
  type SimulationInjection,
} from "@/lib/hallucination-simulation"
import { buildInvestigationReport } from "@/lib/investigation-report"
import { investigationStatusLabel } from "@/lib/claim-intelligence"
import { assembleFirewallCoreResult } from "@/lib/firewall-core"
import { checkNumericConsistency } from "@/lib/consistency/numeric"
import { checkDateConsistency } from "@/lib/consistency/date"
import { checkEntityConsistency } from "@/lib/consistency/entity"
import type { SSEEvent, Domain, FirewallDomain } from "@/types"
import crypto from "crypto"

const STOCHASTIC_ENABLED = false // Disabled for deterministic behavior

// In-memory cache for deterministic identical inputs
const VERIFICATION_CACHE = new Map<string, SSEEvent[]>()

function getCacheKey(body: any) {
  return crypto.createHash('sha256').update(JSON.stringify({
    q: body.query,
    d: body.domain,
    r: body.rawLlmResponse,
    f: body.firewallEnabled !== false,
    i: body.docId || body.datasetId
  })).digest('hex')
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    query: string
    domain?: Domain
    user?: string
    docId?: string
    datasetId?: string
    /** Firewall ON/OFF toggle — when false, skip all verification stages */
    firewallEnabled?: boolean
    /** Chapter 11 — optional controlled evaluation mode */
    simulationMode?: boolean
    simulationCategory?: SimulationCategory | "auto"
    queryId?: string
    rawLlmResponse?: string
    provider?: string
    model?: string
  }

  const query = body.query
  const user = body.user || "enterprise-user"
  const firewallEnabled = body.firewallEnabled !== false // default: true
  const queryId = body.queryId || crypto.randomUUID()
  const timer = new LatencyTracker()

  const targetId = body.datasetId || body.docId
  const registryDoc = targetId ? getDocById(targetId) : null
  const isDataset = Boolean(registryDoc?.isDataset)
  const embedDocId = registryDoc ? getEmbedDocId(registryDoc) : targetId
  const docTitle = registryDoc?.datasetName || registryDoc?.title || registryDoc?.filename

  const selectedDomainRaw = (body.domain || registryDoc?.domain || "").toLowerCase()
  const userDomain: FirewallDomain | undefined =
    selectedDomainRaw === "legal"
      ? "legal"
      : selectedDomainRaw === "healthcare"
      ? "healthcare"
      : selectedDomainRaw === "enterprise" || selectedDomainRaw === "compliance"
      ? "enterprise"
      : undefined

  const detection = detectDomain({
    query,
    filename: registryDoc?.filename,
    hintedDomain: userDomain || body.domain,
  })
  const domain: Domain = userDomain || detection.legacyDomain
  const firewallDomain: FirewallDomain = userDomain || detection.firewallDomain
  const collection = collectionFor(firewallDomain)

  const encoder = new TextEncoder()
  const cacheKey = getCacheKey(body)
  const cachedEvents = VERIFICATION_CACHE.get(cacheKey)

  const stream = new ReadableStream({
    async start(controller) {
      if (cachedEvents) {
        for (const event of cachedEvents) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ ...event, queryId })}\n\n`)
          )
        }
        controller.close()
        return
      }

      const recordedEvents: SSEEvent[] = []

      const send = (event: SSEEvent) => {
        recordedEvents.push(event)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ ...event, queryId })}\n\n`)
        )
      }

      const auditBase = {
        id: queryId,
        docId: registryDoc?.id || embedDocId,
        docTitle,
        embedDocId,
        datasetId: isDataset ? embedDocId : undefined,
        firewallDomain,
      }

      try {
        send({
          stage: "received",
          data: { queryId, query, domain, docId: auditBase.docId, docTitle, firewallDomain, firewallEnabled },
        })
        await delay(80)

        send({
          stage: "domain_detection",
          data: {
            queryId,
            firewallDomain,
            confidence: detection.confidence,
            reason: detection.reason,
            matchedSignals: detection.matchedSignals,
            collection,
          },
        })

        // Common domain system prompt for independent raw generation
        const systemPrompt = [
          `You are an AI assistant answering a query in the ${firewallDomain} domain.`,
          `Query: "${query}"`,
          `Provide a clear, professional, direct, and factual answer based on your general knowledge.`,
          `Do not invent speculative facts or claim that your answer is already verified.`,
        ].join("\n")

        // ─── FIREWALL DISABLED BYPASS ─────────────────────────────────────────
        if (!firewallEnabled) {
          timer.start("llm")
          let rawLlmText = body.rawLlmResponse || ""
          let generatorModel = ""
          let generatorProvider = ""
          if (!rawLlmText) {
            try {
              const generated = await callGeneratorLLM(query, systemPrompt, body.provider, body.model)
              rawLlmText = generated.text
              generatorModel = generated.model
              generatorProvider = generated.provider
            } catch (err) {
              rawLlmText = `Error generating response: ${err instanceof Error ? err.message : "Unknown error"}`
            }
          }
          timer.end("llm")

          send({
            stage: "llm_response",
            data: {
              queryId,
              text: rawLlmText,
              firewallEnabled: false,
              generatorModel,
              role: "untrusted_generator",
              note: "OpenRouter Generator output delivered directly to user without verification",
            },
          })
          await delay(50)

          send({
            stage: "firewall_bypassed",
            data: {
              queryId,
              firewallEnabled: false,
              message: "Firewall is OFF — Unverified AI Response delivered directly to user without claim verification or knowledge base evidence check",
            },
          })
          await delay(50)

          send({
            stage: "final_response",
            data: {
              queryId,
              text: rawLlmText,
              rawLlmResponse: rawLlmText,
              displayedResponse: rawLlmText,
              firewallEnabled: false,
              firewallDomain,
              sourcesUsed: [],
              decision: "bypass",
              decisionEngineReason: "Firewall protection is turned OFF — unverified AI response delivered directly",
              confidenceScore: null,
              trustScore: null,
              explanation: {
                title: "FIREWALL OFF — UNVERIFIED AI RESPONSE",
                statusText: "Firewall Bypassed",
                bullets: [
                  { icon: "warn", text: "Firewall protection is turned OFF." },
                  { icon: "warn", text: "AI response delivered directly to user without claim verification." },
                  { icon: "warn", text: "No knowledge base evidence cross-checking performed." },
                ],
              },
              heatmap: null,
              reliability: null,
              unverified: true,
            },
          })

          saveAuditEntry({
            query,
            domain,
            llmResponse: rawLlmText,
            factScore: 0,
            confidenceScore: 0,
            decision: "pass",
            flaggedSpans: [],
            finalResponse: rawLlmText,
            sourcesUsed: [],
            reason: "Firewall disabled — response delivered unverified",
            user,
            responseTimeMs: timer.snapshot().totalMs,
            reliability: null as unknown as ReliabilityReport,
            trustScore: 0,
            ...auditBase,
          })

          saveInvestigationRecord({
            id: queryId,
            queryId,
            timestamp: new Date().toISOString(),
            query,
            domain,
            firewallDomain,
            datasetId: auditBase.datasetId,
            datasetName: docTitle,
            docId: auditBase.docId,
            docTitle,
            firewallEnabled: false,
            user,
            rawLlmResponse: rawLlmText,
            provider: generatorProvider || body.provider,
            model: generatorModel || body.model,
            generatorModel,
            claims: [],
            evidence: [],
            contradictions: [],
            factScore: 0,
            confidenceScore: 0,
            trustScore: 0,
            riskScore: 100,
            decision: "pass",
            decisionReason: "Firewall disabled — response delivered unverified",
            finalDeliveredResponse: rawLlmText,
            pipelineEvents: [
              { stage: "received", timestamp: new Date().toISOString(), data: { summary: "Query received" } },
              { stage: "llm_generated", timestamp: new Date().toISOString(), data: { summary: "Raw AI response generated" } },
              { stage: "firewall_bypassed", timestamp: new Date().toISOString(), data: { summary: "Firewall bypassed (OFF)" } },
              { stage: "final_response", timestamp: new Date().toISOString(), data: { summary: "Unverified response delivered to user" } },
            ],
            responseTimeMs: timer.snapshot().totalMs,
          })
          return
        }
        // ─── END FIREWALL BYPASS ──────────────────────────────────────────────
        await delay(80)

        if (firewallEnabled && !targetId) {
          const msg = "Select a Knowledge Base document/dataset first to enable firewall verification."
          send({
            stage: "decision",
            data: {
              decision: "block",
              reason: "No Knowledge Base document or dataset selected. Select a Knowledge Base document/dataset first.",
              explanation: {
                title: "BLOCKED — No Knowledge Base Selected",
                bullets: [
                  { icon: "cross", text: "Firewall is ON, but no Knowledge Base document or dataset was selected." },
                  { icon: "cross", text: "Select a document or dataset from the dropdown to verify responses." },
                ],
              },
            },
          })
          send({
            stage: "final_response",
            data: {
              queryId,
              text: msg,
              displayedResponse: msg,
              rawLlmResponse: body.rawLlmResponse || "",
              firewallEnabled: true,
              firewallDomain,
              sourcesUsed: [],
              decision: "block",
              decisionEngineReason: "No Knowledge Base document or dataset selected.",
              confidenceScore: 0,
              trustScore: 0,
              explanation: {
                title: "FIREWALL BLOCKED — NO DATASET SELECTED",
                statusText: "Blocked",
                bullets: [
                  { icon: "cross", text: "Firewall is ON, but no Knowledge Base document or dataset was selected." },
                  { icon: "cross", text: "Please select an active Knowledge Base dataset from the selector to verify claims." },
                ],
              },
              unverified: true,
            },
          })
          return
        }

        if (body.docId && !registryDoc) {
          send({
            stage: "error",
            data: {
              error: "Selected document was not found. Re-upload the PDF or pick another.",
            },
          })
          return
        }

        const security = detectPromptInjection(query)
        send({
          stage: "prompt_security",
          data: {
            status: security.status,
            reason: security.reason,
            matchedPatterns: security.matchedPatterns,
          },
        })

        if (security.isMalicious) {
          const finalResponse = PROMPT_INJECTION_USER_MESSAGE
          const latency = timer.snapshot()
          const failure = classifyFailure({
            decision: "prompt_injection",
            reason: security.reason || undefined,
          })
          const reliability: ReliabilityReport = {
            latency,
            riskPrediction: {
              probability: 1,
              retrievalConfidence: 0,
              avgChunkSimilarity: 0,
              evidenceAvailability: 0,
              factors: ["Prompt injection — LLM skipped"],
            },
            trust: computeTrustScore({
              evidenceQuality: 0,
              consistencyScore: 0,
              freshnessScore: 0,
              confidenceScore: 0,
            }),
            freshness: {
              freshnessScore: 0,
              outdatedDocs: [],
              preferredDocs: [],
              details: [],
            },
            failureClass: failure.failureClass,
            failureReason: failure.failureReason,
            evidenceSnippets: [],
          }

          const explanation = buildDecisionExplanation({
            decision: "block",
            confidenceScore: 0,
            factScore: 0,
            flaggedSpans: [],
            sourcesUsed: [],
            domain,
            reason: `Prompt injection: ${security.reason}`,
          })
          explanation.title = "BLOCKED — Prompt Injection"
          explanation.bullets = [
            { icon: "cross", text: "Potential Prompt Injection Detected" },
            { icon: "cross", text: security.reason || "Policy violation" },
            { icon: "cross", text: "LLM call was not executed" },
          ]

          send({
            stage: "decision",
            data: {
              decision: "prompt_injection",
              reason: security.reason,
              explanation,
              reliability,
              failureClass: failure.failureClass,
            },
          })
          send({
            stage: "final_response",
            data: {
              queryId,
              text: finalResponse,
              displayedResponse: finalResponse,
              decision: "block",
              firewallEnabled: true,
              sourcesUsed: [],
              explanation,
              heatmap: { overallConfidencePercent: 0, sentences: [] },
              reliability,
            },
          })

          saveAuditEntry({
            query,
            domain,
            llmResponse: "",
            factScore: 0,
            confidenceScore: 0,
            decision: "prompt_injection",
            flaggedSpans: [],
            finalResponse,
            sourcesUsed: [],
            reason: security.reason || "Prompt injection detected",
            explanation,
            eventType: "prompt_injection",
            user,
            detectionReason: security.reason || undefined,
            responseTimeMs: latency.totalMs,
            reliability,
            trustScore: 0,
            failureClass: failure.failureClass,
            ...auditBase,
          })
          return
        }

        const kbOpts = {
          topK: 10,
          domain,
          docId: isDataset ? undefined : embedDocId,
          datasetId: isDataset ? embedDocId : undefined,
          targetId: targetId || embedDocId,
          collection,
          firewallDomain,
        }

        timer.start("retrieval")
        const { matches: rawMatches } = await queryKB(query, kbOpts)
        timer.end("retrieval")

        let kbMatches = prioritizeFreshMatches(rawMatches)
        const retrievedContext = kbMatches
          .map((m) => {
            const loc = m.sheet ? ` [Sheet: ${m.sheet}${m.row ? `, Row ${m.row}` : ""}]` : ""
            return `[${m.sourceFile || m.title}${loc}]: ${m.text}`
          })
          .join("\n\n")
        const retrievedTexts = kbMatches.map((m) => m.text)
        const evidenceSnippets = buildEvidenceSnippets(kbMatches)

        const freshness = assessDocumentFreshness({
          matchTitles: kbMatches.map((m) => m.title),
          matchTexts: kbMatches.map((m) => m.text),
          matchDocIds: kbMatches.map((m) => m.docId),
        })

        const riskPrediction = predictHallucinationRisk({
          retrievalScores: kbMatches.map((m) => m.score),
          evidenceAvailable: kbMatches.length > 0,
          matchCount: kbMatches.length,
        })

        const { predictive, adaptive, memoryHit } = runPredictiveStage({
          query,
          retrievalScores: kbMatches.map((m) => m.score),
          matchCount: kbMatches.length,
          firewallDomain,
        })

        // Chapter 9 — consult investigation memory before full investigation
        const adaptivePlan = consultInvestigationMemory({
          query,
          firewallDomain,
        })
        if (adaptivePlan.escalateStrictness && adaptive.mode === "medium") {
          adaptive.mode = "strict"
          adaptive.passThreshold = Math.max(adaptive.passThreshold, 0.78)
        }
        if (adaptivePlan.forceMedicalDosageCheck) {
          adaptive.mode = "critical"
          adaptive.passThreshold = Math.max(adaptive.passThreshold, 0.88)
        }
        if (adaptivePlan.forceConflictAnalysis) {
          predictive.factors = [
            ...new Set([
              ...predictive.factors,
              "Adaptive memory: prior conflict patterns — conflict analysis prioritised",
            ]),
          ]
        }
        if (adaptivePlan.forceLegalSectionCheck) {
          predictive.factors = [
            ...new Set([
              ...predictive.factors,
              "Adaptive memory: prior legal section misinterpretations — extra legal verification",
            ]),
          ]
        }

        send({
          stage: "reliability",
          data: {
            predictiveRisk: predictive,
            adaptive,
            memoryHit: memoryHit
              ? {
                  matched: true,
                  priorQuestion: memoryHit.question,
                  priorCause: memoryHit.rootCauses.join(", "),
                }
              : { matched: false },
            adaptiveMemory: {
              matched: adaptivePlan.matched,
              summary: adaptivePlan.summary,
              strategyHints: adaptivePlan.strategyHints,
              similarCount: adaptivePlan.similarInvestigations.length,
              patternCount: adaptivePlan.matchedPatterns.length,
              escalateStrictness: adaptivePlan.escalateStrictness,
            },
            preLlm: true,
          },
        })

        // Memory hint only — never early-BLOCK; Firewall Core will rewrite if evidence is thin
        if (memoryHit && kbMatches.length === 0) {
          predictive.factors = [
            ...new Set([
              ...predictive.factors,
              "Adaptive memory: similar prior missing-evidence pattern — prefer recovery rewrite",
            ]),
          ]
        }

        if (embedDocId && kbMatches.length === 0) {
          const { countVectorsFor } = await import("@/lib/pinecone")
          const count = countVectorsFor(embedDocId)
          const diag = `ID: ${embedDocId}, Chunks in memory: ${count}, Collection: ${collection}`
          send({
            stage: "error",
            data: {
              error: count > 0 
                ? `No matches found for this document despite having ${count} chunks in memory. Filters: docId=${kbOpts.docId || ""} datasetId=${kbOpts.datasetId || ""} collection=${kbOpts.collection}` 
                : `No indexed content found for this document or dataset. Please verify indexing status. [Diag: ${diag}]`,
            },
          })
          return
        }

        const conflictResult = detectDocumentConflicts(
          kbMatches.map((m) => ({
            id: m.id,
            title: m.sourceFile || m.title,
            text: m.text,
            score: m.score,
          }))
        )
        send({
          stage: "conflict_check",
          data: {
            hasConflict: conflictResult.hasConflict,
            conflicts: conflictResult.conflicts,
            note: conflictResult.hasConflict
              ? "Conflicts noted — Firewall Core will prefer authoritative evidence via REWRITE (not early block)"
              : undefined,
          },
        })

        // Do NOT early-exit on conflicts — Response Recovery + Decision Intelligence handle them

        let llmResponse = body.rawLlmResponse || ""
        let generatorModel = ""
        let generatorProvider = ""
        timer.start("llm")
        if (!llmResponse) {
          try {
            const generated = await callGeneratorLLM(query, systemPrompt, body.provider, body.model)
            llmResponse = generated.text
            generatorModel = generated.model
            generatorProvider = generated.provider
          } catch (err) {
            timer.end("llm")
            const message = err instanceof Error ? err.message : "LLM call failed"
            send({ stage: "error", data: { queryId, error: message } })
            return
          }
        }
        timer.end("llm")

        const originalLlmResponse = llmResponse
        let simulationInjection: SimulationInjection | null = null
        let simulationEvaluation: SimulationEvaluation | null = null
        const simulationStartedAt = Date.now()
        let crossVerifier: CrossVerifierOpinion | null = null

        // Chapter 11 — controlled hallucination on experimental copy only (KB untouched)
        if (body.simulationMode) {
          simulationInjection = injectHallucination({
            originalResponse: originalLlmResponse,
            category: body.simulationCategory || "auto",
            firewallDomain,
            query,
          })
          // Pipeline investigates the experimental copy; original preserved for display
          llmResponse = simulationInjection.mutatedResponse
          send({
            stage: "reliability",
            data: {
              simulation: {
                active: true,
                category: simulationInjection.category,
                categoryLabel: simulationInjection.categoryLabel,
                description: simulationInjection.description,
                originalSnippet: simulationInjection.originalSnippet,
                injectedSnippet: simulationInjection.injectedSnippet,
                expectedDecision: simulationInjection.expectedDecision,
                originalResponse: originalLlmResponse,
                experimentalResponse: llmResponse,
              },
              preLlm: false,
            },
          })
        }

        send({
          stage: "llm_response",
          data: {
            text: originalLlmResponse,
            experimentalText: simulationInjection ? llmResponse : undefined,
            simulationActive: Boolean(simulationInjection),
            generatorModel,
            role: "untrusted_generator",
            note: "OpenRouter Generator output is untrusted input to the Hallucination Firewall",
          },
        })
        await delay(80)

        // Model 2 — Cross-Verifier (advisory opinion only; never final authority)
        crossVerifier = await runCrossVerifier({
          query,
          originalResponse: originalLlmResponse,
          evidenceSnippets: kbMatches.map(
            (m) => `${m.sourceFile || m.title}: ${m.text.slice(0, 400)}`
          ),
          firewallDomain,
        })
        send({
          stage: "reliability",
          data: {
            crossVerifier,
            note: "Cross-Verifier is advisory only — Firewall Core retains final authority",
          },
        })
        await delay(60)

        // ── Claim Intelligence Engine (Chapter 2) — BEFORE any evidence retrieval ──
        send({
          stage: "claim_extraction",
          data: { status: "extracting", phase: "claim_intelligence" },
        })

        const claimIntel = buildClaimObjects({
          responseText: llmResponse,
          domain,
          firewallDomain,
        })

        send({
          stage: "claim_extraction",
          data: {
            status: "structured",
            phase: "claim_intelligence",
            summary: claimIntel.summary,
            compositesDecomposed: claimIntel.compositesDecomposed,
            count: claimIntel.objects.length,
            skippedCount: claimIntel.skipped.length,
            claims: claimIntel.objects.map((c) => ({
              id: c.id,
              claim: c.originalClaim,
              category: c.category,
              domain: c.domain,
              namedEntities: c.namedEntities,
              numericalValues: c.numericalValues,
              dates: c.dates,
              legalSections: c.legalSections,
              medicalTerms: c.medicalTerms,
              policyReferences: c.policyReferences,
              decomposedFromComposite: c.decomposedFromComposite,
              investigationStatus: c.investigationStatus,
              investigationStatusLabel: investigationStatusLabel(c.investigationStatus),
              isFactual: c.isFactual,
              // Pre-evidence placeholders for UI
              evidenceFound: false,
              similarity: 0,
              confidence: 0,
              verdict: "unsupported",
              status: "uncertain",
              supportStatus: "unsupported",
            })),
          },
        })
        await delay(120)

        // Mark waiting → under verification as evidence pass begins
        send({
          stage: "claim_extraction",
          data: {
            status: "verifying",
            phase: "claim_investigation",
            claims: claimIntel.objects.map((c) => ({
              id: c.id,
              claim: c.originalClaim,
              category: c.category,
              investigationStatus: "under_verification",
              investigationStatusLabel: investigationStatusLabel("under_verification"),
            })),
          },
        })

        timer.start("verification")
        const { claims, evidenceIntelligence, reasoningIntelligence } =
          await verifyClaimsWithEvidence({
          responseText: llmResponse,
          query,
          domain,
          docId: isDataset ? undefined : embedDocId,
          datasetId: isDataset ? embedDocId : undefined,
          firewallDomain,
          claimObjects: claimIntel.objects,
        })
        send({
          stage: "claim_extraction",
          data: {
            claims,
            count: claims.length,
            phase: "claim_investigation",
            summary: claimIntel.summary,
            compositesDecomposed: claimIntel.compositesDecomposed,
            status: "complete",
          },
        })

        send({
          stage: "evidence_matching",
          data: {
            phase: "evidence_investigation",
            evidenceSummary: evidenceIntelligence.summary,
            reasoningSummary: reasoningIntelligence.summary,
            reasoning: {
              summary: reasoningIntelligence.summary,
              hasReasoningHallucination:
                reasoningIntelligence.hasReasoningHallucination,
              acceptedCount: reasoningIntelligence.acceptedCount,
              rejectedCount: reasoningIntelligence.rejectedCount,
              claimResults: reasoningIntelligence.claimResults.map((r) => ({
                claimId: r.claimId,
                claim: r.claim,
                verdict: r.verdict,
                explanation: r.explanation,
                errors: r.errors,
                evidenceUsed: r.evidenceUsed,
                conclusionJustified: r.conclusionJustified,
                riskBoost: r.riskBoost,
              })),
              discourseErrors: reasoningIntelligence.discourseErrors,
            },
            retrievedEvidence: evidenceIntelligence.displayCards.map((c) => ({
              documentName: c.documentName,
              datasetName: c.datasetName,
              sourceFile: c.sourceFile,
              fileType: c.fileType,
              sheet: c.sheet,
              row: c.row,
              columns: c.columns,
              page: c.page,
              section: c.section,
              paragraph: c.paragraph,
              similarity: c.similarity,
              relation: c.relation,
              authorityLevel: c.authorityLevel,
              reason: c.reason,
              claimId: c.claimId,
              claimSnippet: c.claimSnippet,
              sufficientForClaim: c.sufficientForClaim,
            })),
            corpusSnippets: kbMatches.slice(0, 4).map((m) => ({
              documentName: m.title,
              paragraph: m.text.slice(0, 280),
              similarity: m.score,
            })),
            perClaimEvidence: evidenceIntelligence.claimReports.map((r) => ({
              claimId: r.claimId,
              claim: r.claim,
              supportStatus: claims.find((c) => c.id === r.claimId)?.supportStatus,
              sufficient: r.sufficient,
              completeness: r.completeness,
              documentsInvestigated: r.documentsInvestigated,
              supportingCount: r.supporting.length,
              contradictingCount: r.contradicting.length,
              rejectedCount: r.rejected.length,
              conflicts: r.conflicts.length,
              missingAspects: r.missingAspects,
              summary: r.summary,
              bestDocument: r.bestEvidence?.documentName,
              bestExcerpt: r.bestEvidence?.text?.slice(0, 200),
              evidenceTrustScore: r.evidenceTrustScore,
              reasoningVerdict: claims.find((c) => c.id === r.claimId)?.reasoningVerdict,
            })),
            conflicts: evidenceIntelligence.allConflicts,
          },
        })
        await delay(80)

        // ─── Consistency Checks (Numeric / Date / Entity) ─────────────────────
        const corpusText = retrievedTexts.join(" ")
        const consistencyClaimResults = claims.slice(0, 8).map((c) => {
          const claimText = c.claim || ""
          // Use retrieved document hint if available, else fall back to full corpus
          const evidenceText = corpusText.slice(0, 2000)
          return {
            claimId: c.id,
            claim: claimText,
            numeric: checkNumericConsistency(claimText, evidenceText),
            date: checkDateConsistency(claimText, evidenceText),
            entity: checkEntityConsistency(claimText, evidenceText, firewallDomain),
          }
        })


        // Per-claim verification updates
        for (const cr of consistencyClaimResults) {
          send({
            stage: "claim_verification_update",
            data: {
              claimId: cr.claimId,
              claim: cr.claim,
              numeric: { status: cr.numeric.status, note: cr.numeric.note },
              date: { status: cr.date.status, note: cr.date.note },
              entity: { status: cr.entity.status, note: cr.entity.note },
            },
          })
        }

        const numericFails = consistencyClaimResults.filter(r => r.numeric.status === "mismatch").length
        const dateFails = consistencyClaimResults.filter(r => r.date.status === "mismatch").length
        const entityFails = consistencyClaimResults.filter(r => r.entity.status === "mismatch").length

        send({
          stage: "numeric_check",
          data: {
            checkedClaims: consistencyClaimResults.length,
            mismatches: numericFails,
            results: consistencyClaimResults.map(r => ({
              claimId: r.claimId,
              status: r.numeric.status,
              note: r.numeric.note,
              claimValues: r.numeric.claimValues.map(v => v.raw),
              evidenceValues: r.numeric.evidenceValues.map(v => v.raw),
            })),
          },
        })

        send({
          stage: "date_check",
          data: {
            checkedClaims: consistencyClaimResults.length,
            mismatches: dateFails,
            results: consistencyClaimResults.map(r => ({
              claimId: r.claimId,
              status: r.date.status,
              note: r.date.note,
              claimDates: r.date.claimDates.map(d => d.raw),
              evidenceDates: r.date.evidenceDates.map(d => d.raw),
            })),
          },
        })

        send({
          stage: "entity_check",
          data: {
            checkedClaims: consistencyClaimResults.length,
            mismatches: entityFails,
            results: consistencyClaimResults.map(r => ({
              claimId: r.claimId,
              status: r.entity.status,
              note: r.entity.note,
              mismatches: r.entity.mismatches.map(m => m.note),
            })),
          },
        })
        // ─── End Consistency Checks ───────────────────────────────────────────

        // Stochastic Output Verification (feeds Consistency Investigation)
        let consistency
        timer.start("consistency")
        if (STOCHASTIC_ENABLED) {
          try {
            const stochastic = await verifyStochasticConsistency({
              query,
              systemPrompt,
              primaryResponse: llmResponse,
              sampleCount: 3,
            })
            consistency = stochastic.result
          } catch {
            consistency = undefined
          }
        }
        timer.end("consistency")

        // Domain structure grounding (policy input — not the final arbiter)
        let domainResult = applyDomainVerification({
          firewallDomain,
          answer: llmResponse,
          retrievedTexts,
          baseConfidence: 0.5,
          provisionalDecision: "pass",
        })
        let domainVerification = domainResult.verification
        const medicalUnsafe = Boolean(domainVerification.unsafe)

        // Send domain verification SSE event
        send({
          stage: "domain_verification",
          data: {
            firewallDomain,
            verification: domainVerification,
            adjustedConfidence: domainResult.confidenceScore,
            unsupportedClaims: (domainResult.verification.details || []).filter(d => d.startsWith("⚠")),
            evidenceFound: (domainResult.verification.evidenceSnippets || []).length,
          },
        })


        const matchedSources = [
          ...new Set(
            claims
              .map((c) => c.retrievedDocument)
              .filter(Boolean)
              .concat(kbMatches.map((m) => m.title)) as string[]
          ),
        ]
        const sources =
          matchedSources.length > 0
            ? matchedSources
            : docTitle
              ? [docTitle]
              : kbMatches.map((m) => m.title).filter(Boolean)

        // Supporting confidence metrics (never sole decision criterion)
        const evidenceQuality =
          claims.length > 0
            ? claims.reduce((s, c) => s + c.similarity, 0) / claims.length
            : kbMatches[0]?.score ?? 0
        const contradictionCount =
          claims.filter((c) => c.supportStatus === "contradicted").length +
          (conflictResult.conflicts?.length || 0) +
          (evidenceIntelligence.allConflicts?.length || 0)
        const numHallucinated = claims.filter(
          (c) => c.status === "hallucinated"
        ).length
        const hallucinatedRatio =
          claims.length > 0 ? numHallucinated / claims.length : 1
        const factScore =
          claims.length > 0
            ? claims.filter((c) => c.supportStatus === "fully_supported").length /
              claims.length
            : 0

        let confidenceScore = scoreConfidence(
          factScore,
          numHallucinated,
          claims.length,
          contradictionCount
        )
        if (consistency) {
          confidenceScore = applyConsistencyPenalty(confidenceScore, consistency)
        }
        if (riskPrediction.probability >= 0.6) {
          confidenceScore = Number(
            Math.max(0, confidenceScore - riskPrediction.probability * 0.08).toFixed(3)
          )
        }

        domainResult = applyDomainVerification({
          firewallDomain,
          answer: llmResponse,
          retrievedTexts,
          baseConfidence: confidenceScore,
          provisionalDecision: "pass",
        })
        domainVerification = domainResult.verification
        confidenceScore = domainResult.confidenceScore

        // Ethics preview for Policy Investigation
        const ethicsPreview = buildSafetyPlatformReport({
          query,
          rawLlmResponse: llmResponse,
          verifiedResponse: llmResponse,
          decision: "pass",
          reason: "pre-decision ethics scan",
          firewallDomain,
          claims,
          kbMatches,
          contradictionCount,
          reliability: {
            latency: timer.snapshot(),
            riskPrediction,
            trust: computeTrustScore({
              evidenceQuality,
              consistencyScore: consistency?.consistencyScore ?? 0.7,
              freshnessScore: freshness.freshnessScore,
              confidenceScore,
            }),
            freshness,
            failureClass: "none",
            evidenceSnippets,
          },
          medicalUnsafe,
        })

        send({
          stage: "ethics_check",
          data: {
            phase: "policy_investigation",
            ethics: ethicsPreview.ethics,
            severity: ethicsPreview.severity,
          },
        })

        // Decision Investigation — sole arbiter (confidence is supporting context only)
        const investigation = await runInvestigationPipeline({
          query,
          rawAnswer: llmResponse,
          claims,
          kbMatches,
          conflicts: conflictResult.conflicts || [],
          firewallDomain,
          domainVerification,
          ethics: ethicsPreview.ethics,
          freshness,
          consistency,
          medicalUnsafe,
          sources,
          confidenceScore,
          evidenceIntelligence,
          reasoningIntelligence,
        })
        timer.end("verification")

        let decision = investigation.decision
        let finalResponse = investigation.finalResponse
        const flaggedSpans = investigation.flaggedSpans
        const decisionValidation = investigation.decisionValidation

        send({
          stage: "fact_check",
          data: {
            phase: "evidence_investigation",
            factScore: investigation.factScore,
            flaggedSpans,
            matchedSources: sources,
            contradictionCount,
            kbCoverage: investigation.evidence.kbCoverage,
            firewallDomain,
            riskPrediction,
            claims,
            supportBreakdown: {
              fully_supported: claims.filter((c) => c.supportStatus === "fully_supported").length,
              partially_supported: claims.filter((c) => c.supportStatus === "partially_supported").length,
              unsupported: claims.filter((c) => c.supportStatus === "unsupported").length,
              contradicted: claims.filter((c) => c.supportStatus === "contradicted").length,
              ambiguous: claims.filter((c) => c.supportStatus === "ambiguous").length,
            },
            investigationPhases: investigation.phases.map((p) => ({
              id: p.id,
              label: p.label,
              summary: p.summary,
            })),
          },
        })
        await delay(100)

        const heatmap = buildConfidenceHeatmap(flaggedSpans, confidenceScore)
        send({
          stage: "confidence_score",
          data: {
            confidenceScore,
            heatmap,
            firewallDomain,
            note: "Confidence is supporting context only — Decision Investigation owns Pass/Rewrite/Block",
          },
        })
        await delay(100)

        const reason =
          investigation.decisionEngineReason ||
          buildReason(
            decision,
            investigation.factScore,
            flaggedSpans,
            domain,
            contradictionCount
          )

        const trust = computeTrustScore({
          evidenceQuality,
          consistencyScore: consistency?.consistencyScore ?? 0.7,
          freshnessScore: freshness.freshnessScore,
          confidenceScore,
        })

        const failure = classifyFailure({
          decision,
          reason,
          kbCoverage: investigation.evidence.kbCoverage,
          avgSimilarity: evidenceQuality,
          contradictionCount,
          outdatedDocs: freshness.outdatedDocs,
          hallucinatedRatio,
          unsupportedClaims: hallucinatedRatio >= 0.4,
        })

        let explanation = buildInvestigationExplanation(investigation, {
          domainLabel: firewallDomain,
        })
        if (domainVerification.details?.length) {
          explanation.bullets.push(
            ...domainVerification.details.slice(0, 3).map((t) => ({
              icon: (t.startsWith("⚠") ? "warn" : "check") as "warn" | "check",
              text: t.replace(/^⚠\s*/, ""),
            }))
          )
        }

        const reliability: ReliabilityReport = {
          consistency,
          latency: timer.snapshot(),
          riskPrediction,
          trust,
          freshness,
          failureClass: failure.failureClass,
          failureReason: failure.failureReason || undefined,
          evidenceSnippets,
          adjustedConfidence: confidenceScore,
        }
        explanation = enrichExplanationWithReliability(explanation, reliability)

        send({
          stage: "reliability",
          data: {
            phase: "consistency_investigation",
            reliability,
            trustScore: trust.trustScore,
            consistencyScore: consistency?.consistencyScore,
            failureClass: failure.failureClass,
            evidenceStrength: ethicsPreview.evidenceStrength,
            governance: ethicsPreview.governance,
            extendedTrust: ethicsPreview.extendedTrust,
            consistencyReport: investigation.consistency,
          },
        })

        // Mandatory Stage 2 Re-Verification for Rewritten Responses
        if (decision === "rewrite") {
          send({
            stage: "rewrite_started",
            data: {
              originalText: llmResponse,
              rewrittenDraft: finalResponse,
              reason: investigation.decisionEngineReason,
            },
          })

          send({
            stage: "reverification",
            data: {
              status: "running_stage_2_reverification",
              target: finalResponse.slice(0, 150),
            },
          })

          try {
            const reverifyResult = await verifyClaimsWithEvidence({
              responseText: finalResponse,
              query,
              domain,
              docId: isDataset ? undefined : embedDocId,
              datasetId: isDataset ? embedDocId : undefined,
              firewallDomain,
            })

            const hasContradiction = reverifyResult.claims.some(
              (c) => c.supportStatus === "contradicted" || c.verdict === "contradiction"
            )
            const allUnsupported =
              reverifyResult.claims.length > 0 &&
              reverifyResult.claims.every((c) => c.supportStatus === "unsupported")

            if (hasContradiction || (allUnsupported && medicalUnsafe)) {
              decision = "block"
              finalResponse = buildBlockMessage(
                query,
                domain,
                "Rewritten response could not be verified against the knowledge base."
              )
              send({
                stage: "decision",
                data: {
                  decision: "block",
                  reason: "Rewritten response failed Stage 2 Re-Verification",
                },
              })
            } else {
              send({
                stage: "rewrite_complete",
                data: {
                  rewrittenText: finalResponse,
                  reverification: "passed",
                  reverifiedClaimsCount: reverifyResult.claims.length,
                },
              })
            }
          } catch (err) {
            console.error("Re-verification error:", err)
          }
        }

        // Domain formatting on verified text (legal/healthcare structure)
        // Only format rewritten responses; NEVER alter raw answer on PASS
        if (decision === "rewrite") {
          const formatted = applyDomainVerification({
            firewallDomain,
            answer: finalResponse,
            retrievedTexts,
            baseConfidence: confidenceScore,
            provisionalDecision: "rewrite",
          })
          finalResponse = formatted.formattedAnswer
          if (formatted.decision === "block") {
            decision = "block"
            finalResponse = formatted.formattedAnswer
          }
        }

        if (decision === "block" && firewallDomain === "enterprise") {
          finalResponse = buildBlockMessage(
            query,
            domain,
            investigation.decisionEngineReason
          )
        }

        send({
          stage: "decision",
          data: {
            phase: "decision_investigation",
            decision,
            reason,
            explanation,
            firewallDomain,
            domainVerification,
            reliability,
            failureClass: failure.failureClass,
            severity: ethicsPreview.severity,
            decisionEngineReason: investigation.decisionEngineReason,
            investigationPhases: investigation.phases,
            validationStages: decisionValidation.stages,
          },
        })
        await delay(200)

        reliability.latency = timer.snapshot()

        const safety = buildSafetyPlatformReport({
          query,
          rawLlmResponse: llmResponse,
          verifiedResponse: finalResponse,
          decision,
          reason: investigation.decisionEngineReason || reason,
          firewallDomain,
          claims,
          kbMatches,
          contradictionCount,
          reliability,
          medicalUnsafe,
        })

        // Trust OS — additive courtroom / radar (may escalate, never sole confidence gate)
        const trustOs = runTrustOperatingSystem({
          query,
          answer: llmResponse,
          finalResponse,
          decision,
          firewallDomain,
          claims,
          evidenceTexts: retrievedTexts,
          retrievalScores: kbMatches.map((m) => m.score),
          contradictionCount,
          conflicts: conflictResult.conflicts || [],
          kbCoverage: investigation.evidence.kbCoverage,
          ethics: safety.ethics,
          avgSimilarity: evidenceQuality,
          outdatedDocs: freshness.outdatedDocs,
          consistencyScore: consistency?.consistencyScore ?? 0.7,
          freshnessScore: freshness.freshnessScore,
          evidenceCoverage: safety.evidenceStrength.evidenceCoverage,
          medicalUnsafe,
          predictive,
          adaptive,
        })

        // Attach Trust OS root causes into justification
        if (trustOs.rootCauseDetail?.length) {
          decisionValidation.rootCauses = [
            ...new Set([
              ...decisionValidation.rootCauses,
              ...trustOs.rootCauseDetail,
            ]),
          ].slice(0, 8)
          decisionValidation.justification.rootCauses =
            decisionValidation.rootCauses
        }

        // AI Courtroom Multi-Agent Verification:
        // The final result is verified and governed based on the courtroom agent jury
        if (trustOs.judgeDecision.decision === "block") {
          if (decision !== "block") {
            decision = "block"
            investigation.decisionEngineReason = `[Courtroom Verdict: BLOCKED] ${trustOs.judgeDecision.summary}`
            decisionValidation.decisionEngineReason = investigation.decisionEngineReason
          }
        } else if (trustOs.judgeDecision.decision === "rewrite") {
          if (decision === "pass") {
            decision = "rewrite"
            investigation.decisionEngineReason = `[Courtroom Verdict: REWRITE] ${trustOs.judgeDecision.summary}`
            decisionValidation.decisionEngineReason = investigation.decisionEngineReason
          }
        }

        // Chapter 9 — adaptive escalation from familiar failure patterns (ADVISORY — never demotes a clean PASS)
        if (decision !== "pass") {
          const unsupportedCount = claims.filter(
            (c) =>
              c.supportStatus === "unsupported" ||
              c.supportStatus === "contradicted" ||
              c.verdict === "unsupported" ||
              c.verdict === "contradiction"
          ).length
          const adaptiveEscalation = applyAdaptiveMemoryEscalation({
            decision,
            unsupportedOrContradicted: unsupportedCount,
            escalateStrictness: adaptivePlan.escalateStrictness,
            similarNonPass: adaptivePlan.similarInvestigations.some(
              (s) => s.decision === "rewrite" || s.decision === "block"
            ),
            forceMedicalDosageCheck: adaptivePlan.forceMedicalDosageCheck,
            query,
          })
          if (adaptiveEscalation.decision !== decision) {
            decision = adaptiveEscalation.decision as typeof decision
            if (adaptiveEscalation.reason) {
              investigation.decisionEngineReason = adaptiveEscalation.reason
              decisionValidation.decisionEngineReason = adaptiveEscalation.reason
            }
          }
        }

        // Canonical finalResponse assignment:
        // ON PASS: original raw response UNCHANGED
        // ON REWRITE: corrected text from response recovery
        // ON BLOCK: safe block message
        if (decision === "pass") {
          finalResponse = originalLlmResponse
        } else if (decision === "rewrite" && investigation.finalResponse) {
          finalResponse = investigation.finalResponse
        } else if (decision === "block") {
          finalResponse = investigation.finalResponse || "This response could not be verified against the selected Knowledge Base and was blocked."
        }

        // Rebuild explanation after any escalation so UI bullets stay truthful
        explanation = buildInvestigationExplanation(
          { ...investigation, decision, finalResponse },
          { domainLabel: firewallDomain }
        )
        explanation = enrichExplanationWithReliability(explanation, reliability)

        const decisionIntelligence = investigation.decisionIntelligence

        if (simulationInjection) {
          simulationEvaluation = evaluateSimulation({
            query,
            firewallDomain,
            injection: simulationInjection,
            actualDecision: decision,
            detectionLatencyMs: Date.now() - simulationStartedAt,
            validationStages: decisionValidation.stages?.map((s) => ({
              label: s.label,
              verdict: s.verdict,
              detail: s.detail,
            })),
            reasoningRejected: reasoningIntelligence.hasReasoningHallucination,
            conflictDetected: Boolean(conflictResult.hasConflict),
            unsupportedClaims: claims.filter(
              (c) =>
                c.supportStatus === "unsupported" || c.verdict === "unsupported"
            ).length,
            contradictedClaims: claims.filter(
              (c) =>
                c.supportStatus === "contradicted" || c.verdict === "contradiction"
            ).length,
            rootCauses: [
              ...(trustOs.rootCauseDetail || []),
              ...(decisionValidation.rootCauses || []),
            ],
          })
        }

        const investigationReport = buildInvestigationReport({
          query,
          firewallDomain,
          decision,
          reason: investigation.decisionEngineReason,
          rawLlmResponse: originalLlmResponse,
          finalResponse,
          claims,
          claimInvestigations: decisionValidation.claimInvestigations,
          reasoningIntelligence,
          decisionIntelligence,
          decisionValidation,
          investigationPhases: investigation.phases,
        })

        const advisoryRootCauses = [...(decisionValidation.rootCauses || [])]
        if (
          crossVerifier?.enabled &&
          crossVerifier.agreementHint === "disagrees" &&
          crossVerifier.suspectedIssues.length > 0
        ) {
          advisoryRootCauses.push(
            `Cross-Verifier (advisory): ${crossVerifier.suspectedIssues.slice(0, 3).join("; ")}`
          )
        }

        const firewallCore = assembleFirewallCoreResult({
          query,
          firewallDomain,
          originalLlmResponse,
          finalResponse,
          decision,
          decisionReason: investigation.decisionEngineReason || reason,
          claims,
          evidence: evidenceIntelligence,
          reasoning: reasoningIntelligence,
          decisionIntelligence,
          ethics: safety.ethics,
          medicalUnsafe,
          investigationReport,
          rootCauses: advisoryRootCauses,
          crossVerifier: crossVerifier
            ? {
                enabled: crossVerifier.enabled,
                model: crossVerifier.model,
                suspectedIssues: crossVerifier.suspectedIssues,
                suggestedFocus: crossVerifier.suggestedFocus,
                agreementHint: crossVerifier.agreementHint,
                authority: "advisory_only",
                note: crossVerifier.note,
              }
            : null,
        })

        const canonicalRecord = saveInvestigationRecord({
          queryId,
          query,
          domain,
          firewallDomain,
          datasetId: auditBase.datasetId,
          datasetName: docTitle,
          docId: auditBase.docId,
          docTitle,
          firewallEnabled: true,
          user,
          rawLlmResponse: originalLlmResponse,
          provider: generatorProvider || body.provider,
          model: generatorModel || body.model,
          generatorModel,
          claims: claims.map(c => ({
            id: c.id,
            claim: c.claim,
            verdict: c.verdict === "supported" ? "supported" : c.verdict === "contradiction" ? "contradicted" : "unsupported",
            status: c.supportStatus === "fully_supported" ? "safe" : c.supportStatus === "contradicted" ? "hallucinated" : "uncertain",
            confidence: c.similarity,
            similarity: c.similarity,
            evidenceSource: c.retrievedDocument,
          })),
          evidence: kbMatches.map(m => ({
            documentName: m.title || "KB",
            paragraph: m.text,
            similarity: m.score
          })),
          contradictions: conflictResult.conflicts?.map(c => ({
            type: "semantic",
            claimText: `Value A: ${c.rawA} vs Value B: ${c.rawB}`,
            evidenceText: `${c.documentA} vs ${c.documentB}`,
            note: `${c.textA} vs ${c.textB}`,
            severity: "high"
          })) || [],
          factScore: investigation.factScore,
          confidenceScore,
          trustScore: trustOs.trustRadar.overall,
          riskScore: Math.round(reliability.riskPrediction.probability * 100),
          decision,
          decisionReason: investigation.decisionEngineReason || reason,
          finalDeliveredResponse: finalResponse,
          pipelineEvents: investigation.phases.map(p => ({
            stage: p.id,
            timestamp: new Date().toISOString(),
          })),
          responseTimeMs: reliability.latency.totalMs,
          courtroom: trustOs.courtroom,
          judgeDecision: trustOs.judgeDecision,
        })

        const displayedResponse =
          decision === "pass"
            ? originalLlmResponse
            : decision === "rewrite"
            ? finalResponse
            : (finalResponse || "This response could not be verified against the selected Knowledge Base and was blocked.")

        send({
          stage: "final_response",
          data: {
            queryId,
            firewallEnabled: true,
            text: displayedResponse,
            displayedResponse,
            canonicalRecord,
            sourcesUsed: sources,
            explanation,
            heatmap,
            firewallDomain,
            domainVerification,
            reliability,
            trustScore: trustOs.trustRadar.overall,
            failureClass: reliability.failureClass,
            safety,
            severity: safety.severity,
            governanceScore: Math.round(trustOs.governance.overall * 100),
            evidenceStrengthPercent: safety.evidenceStrength.evidenceStrengthPercent,
            rawLlmResponse: originalLlmResponse,
            experimentalResponse: simulationInjection ? llmResponse : undefined,
            simulationEvaluation,
            simulation: simulationInjection
              ? {
                  active: true,
                  category: simulationInjection.category,
                  categoryLabel: simulationInjection.categoryLabel,
                  description: simulationInjection.description,
                  originalSnippet: simulationInjection.originalSnippet,
                  injectedSnippet: simulationInjection.injectedSnippet,
                  expectedDecision: simulationInjection.expectedDecision,
                }
              : undefined,
            retrievedEvidence: safety.retrievedEvidence,
            claims,
            trustOs,
            decisionValidation,
            decisionIntelligence,
            investigationReport,
            firewallCore,
            crossVerifier,
            generatorModel,
            trustVerdict: firewallCore.decision.trustVerdictLabel,
            action: firewallCore.decision.actionLabel,
            decision,
            decisionEngineReason: investigation.decisionEngineReason,
            validationStages: decisionValidation.stages,
            investigationPhases: investigation.phases,
            correctionsApplied: investigation.correctionsApplied,
            reasoningIntelligence: {
              summary: reasoningIntelligence.summary,
              hasReasoningHallucination:
                reasoningIntelligence.hasReasoningHallucination,
              acceptedCount: reasoningIntelligence.acceptedCount,
              rejectedCount: reasoningIntelligence.rejectedCount,
              uncertainCount: reasoningIntelligence.uncertainCount,
              claimResults: reasoningIntelligence.claimResults,
              discourseErrors: reasoningIntelligence.discourseErrors,
            },
          },
        })

        saveAuditEntry({
          query,
          domain,
          llmResponse,
          factScore: investigation.factScore,
          confidenceScore,
          decision,
          flaggedSpans,
          finalResponse,
          sourcesUsed: sources,
          reason:
            decision === "block"
              ? investigation.decisionEngineReason ||
                trustOs.rootCauseDetail[0] ||
                reliability.failureReason ||
                reason
              : investigation.decisionEngineReason || reason,
          explanation,
          heatmap,
          eventType: "query",
          user,
          responseTimeMs: reliability.latency.totalMs,
          domainVerification,
          reliability,
          trustScore: trustOs.trustRadar.overall,
          consistencyScore: consistency?.consistencyScore,
          failureClass: reliability.failureClass,
          safety,
          governanceScore: Math.round(trustOs.governance.overall * 100),
          evidenceStrengthPercent: safety.evidenceStrength.evidenceStrengthPercent,
          severity: safety.severity,
          trustOs,
          decisionValidation,
          ...auditBase,
        })

        // Chapter 9 — every completed investigation becomes future intelligence
        learnFromInvestigation({
          query,
          firewallDomain,
          decision,
          rawLlmResponse: llmResponse,
          finalResponse,
          reason: investigation.decisionEngineReason || reason,
          claims: claims.map((c) => ({
            claim: c.claim,
            verdict: c.verdict,
            supportStatus: c.supportStatus,
          })),
          evidenceSnippets: retrievedTexts.slice(0, 12),
          contradictions: (conflictResult.conflicts || []).map(
            (c) => `${c.documentA} vs ${c.documentB} (${c.rawA} ≠ ${c.rawB})`
          ),
          rootCauses: [
            ...(trustOs.rootCauseDetail || []),
            ...(decisionValidation.rootCauses || []),
          ].slice(0, 8),
          dna: trustOs.dna,
          reasoningErrors: reasoningIntelligence.discourseErrors?.map(
            (e) => e.category || e.detail || ""
          ),
          hasConflicts: Boolean(conflictResult.hasConflict),
          stages: decisionValidation.stages?.map((s) => ({
            id: s.id,
            label: s.label,
            verdict: s.verdict,
            detail: s.detail,
          })),
          trustVerdict:
            decision === "pass"
              ? "Trusted"
              : decision === "rewrite"
                ? "Corrected"
                : "Rejected",
          sourcesUsed: sources,
        })

        // Chapter 8 — continuous ecosystem trust after audit persists
        recordVerificationTrustEvent({
          decision,
          firewallDomain,
          trustRadarOverall: trustOs.trustRadar.overall,
          hadHallucinationDna: (trustOs.dna?.length || 0) > 0,
          knowledgeConflicts: conflictResult.conflicts?.length || 0,
        })
        VERIFICATION_CACHE.set(cacheKey, recordedEvents)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        console.error("[/api/query] Pipeline error:", message)
        if (firewallEnabled) {
          const failMessage = "Verification unavailable. The response could not be validated."
          send({
            stage: "decision",
            data: {
              queryId,
              decision: "block",
              reason: `Fail-closed security: Verification engine error (${message}) while firewall is ON.`,
            },
          })
          send({
            stage: "final_response",
            data: {
              queryId,
              text: failMessage,
              firewallEnabled: true,
              decision: "block",
              sourcesUsed: [],
              decisionEngineReason: `Fail-closed security: ${message}`,
              reliability: null,
            },
          })
        } else {
          send({ stage: "error", data: { queryId, error: message } })
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
