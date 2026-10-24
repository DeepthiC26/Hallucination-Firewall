/**
 * Multi-domain types for Hallucination Firewall Phase 2.
 * Extends existing Domain without breaking hr/finance/general uploads.
 */

/** Primary firewall domains (routing targets). */
export type FirewallDomain = "enterprise" | "legal" | "healthcare"

/** Legacy + extended domain tags used in registry / metadata. */
export type Domain =
  | FirewallDomain
  | "hr"
  | "finance"
  | "general"

export type Decision = "block" | "rewrite" | "pass" | "prompt_injection" | "conflict"
export type SpanStatus = "safe" | "uncertain" | "hallucinated"
export type AuditEventType =
  | "query"
  | "prompt_injection"
  | "conflicting_evidence"

export interface SpanResult {
  sentence: string
  score: number
  status: SpanStatus
  matchedSource?: string
}

export interface PipelineStage {
  id: string
  label: string
  status: "idle" | "active" | "complete" | "error"
  data?: Record<string, unknown>
}

export interface ExplanationBullet {
  icon: "check" | "warn" | "cross"
  text: string
}

export interface DecisionExplanation {
  decision: Decision
  title: string
  bullets: ExplanationBullet[]
  summary: string
}

export interface HeatmapSentence {
  index: number
  sentence: string
  confidencePercent: number
  band: "green" | "yellow" | "red"
  statusLabel: string
  statusEmoji: string
  matchedSource?: string
  rawScore: number
  spanStatus: SpanStatus
}

export interface ConfidenceHeatmap {
  overallConfidencePercent: number
  sentences: HeatmapSentence[]
}

export interface ConflictDetail {
  kind: string
  valueA: number
  valueB: number
  rawA: string
  rawB: string
  documentA: string
  documentB: string
  textA: string
  textB: string
}

/** Domain-specific verification payload attached to responses / audit. */
export interface DomainVerification {
  firewallDomain: FirewallDomain
  citations?: string[]
  sections?: string[]
  clauses?: string[]
  acts?: string[]
  medicalEntities?: string[]
  guidelines?: string[]
  evidenceSnippets?: string[]
  details?: string[]
  unsafe?: boolean
}

/** AI Reliability & Performance Layer (Phase 3). */
export type FailureClass =
  | "missing_evidence"
  | "conflicting_documents"
  | "outdated_policy"
  | "low_similarity"
  | "unsupported_claim"
  | "prompt_injection"
  | "none"

export interface LatencyBreakdown {
  retrievalMs: number
  llmMs: number
  verificationMs: number
  rewriteMs: number
  consistencyMs: number
  totalMs: number
}

export interface ConsistencyResult {
  consistencyScore: number
  sampleCount: number
  pairwiseSimilarities: number[]
  divergenceRisk: number
  samplesPreview: string[]
}

export interface HallucinationRiskPrediction {
  probability: number
  retrievalConfidence: number
  avgChunkSimilarity: number
  evidenceAvailability: number
  factors: string[]
}

export interface FreshnessAssessment {
  freshnessScore: number
  outdatedDocs: string[]
  preferredDocs: string[]
  details: string[]
}

export interface TrustScoreResult {
  trustScore: number
  evidenceQuality: number
  consistencyScore: number
  freshnessScore: number
  confidenceScore: number
  breakdown: string[]
}

export interface EvidenceSnippet {
  document: string
  snippet: string
  similarity: number
}

export interface ReliabilityReport {
  consistency?: ConsistencyResult
  latency: LatencyBreakdown
  riskPrediction: HallucinationRiskPrediction
  trust: TrustScoreResult
  freshness: FreshnessAssessment
  failureClass: FailureClass
  failureReason?: string
  evidenceSnippets: EvidenceSnippet[]
  adjustedConfidence?: number
}

export interface FirewallResult {
  query: string
  llmResponse: string
  factScore: number
  confidenceScore: number
  decision: Decision
  flaggedSpans: SpanResult[]
  finalResponse: string
  sourcesUsed: string[]
  reason: string
  explanation?: DecisionExplanation
  heatmap?: ConfidenceHeatmap
  conflicts?: ConflictDetail[]
  eventType?: AuditEventType
  user?: string
  responseTimeMs?: number
  detectionReason?: string
  docId?: string
  docTitle?: string
  embedDocId?: string
  /** Phase 2: normalized routing domain */
  firewallDomain?: FirewallDomain
  domainVerification?: DomainVerification
  /** Phase 3: reliability & performance */
  reliability?: ReliabilityReport
  trustScore?: number
  consistencyScore?: number
  failureClass?: FailureClass
  /** Phase 4: Safety Platform */
  safety?: SafetyPlatformReport
  governanceScore?: number
  evidenceStrengthPercent?: number
  severity?: HallucinationSeverity
  /** AI Trust Operating System */
  trustOs?: TrustOsReportPayload
  /** Decision Validation Platform (multi-stage stress tests) */
  decisionValidation?: DecisionValidationPayload
}

/** Multi-stage Decision Validation report (additive). */
export interface DecisionValidationPayload {
  stages: Array<{
    id: string
    label: string
    verdict: string
    weight: number
    detail: string
    evidence?: string[]
    policyTriggered?: string
  }>
  stageSummary: { pass: number; warn: number; fail: number }
  claimInvestigations: Array<{
    id: string
    claim: string
    supportingEvidence: string[]
    contradictingEvidence: string[]
    retrievedDocuments: string[]
    retrievedPages: number[]
    reasoningPath: string[]
    logicalValidation: string
    riskLevel: string
    confidence: number
    decision: string
    why: string
    failedRules: string[]
  }>
  decision: string
  decisionEngineReason: string
  justification: {
    whatAiGenerated: string
    whatEvidenceRetrieved: string[]
    claimsExtracted: number
    claimsFailed: string[]
    validationRulesFailed: string[]
    evidenceSupporting: string[]
    documentsContradicting: string[]
    domainPoliciesTriggered: string[]
    correctionsApplied: string
    whyFinalDecision: string
    rootCauses: string[]
  }
  rootCauses: string[]
}

/** Serialized Trust OS report attached to audit / SSE (additive). */
export interface TrustOsReportPayload {
  courtroom: Array<{
    agent: string
    role: string
    verdict: string
    confidence: number
    reasoning: string[]
    findings: string[]
  }>
  judgeDecision: {
    decision: string
    summary: string
    votes: Record<string, number>
  }
  reasoningGraph: {
    nodes: Array<{ id: string; label: string; type: string; supported: boolean }>
    edges: Array<{ from: string; to: string; fallacy?: string }>
    fallacies: Array<{ type: string; detail: string }>
  }
  rootCauses: string[]
  rootCauseDetail: string[]
  conflictResolution: {
    hasConflict: boolean
    conflicts: Array<{
      topic: string
      documentA: string
      documentB: string
      authorityWinner: string
      reason: string
    }>
    recommendedSource?: string
  }
  predictiveRisk: {
    probability: number
    level: string
    factors: string[]
    strictMode: boolean
  }
  adaptive: {
    domain: string
    mode: string
    passThreshold: number
    rewriteThreshold: number
  }
  memoryHit?: { matched: boolean; priorQuestion?: string; priorCause?: string }
  knowledgeGaps: Array<{ topic: string; askCount: number; recommendation: string }>
  trustRadar: {
    evidenceQuality: number
    reasoning: number
    logic: number
    consistency: number
    freshness: number
    compliance: number
    historicalAccuracy: number
    policyAlignment: number
    overall: number
  }
  governance: {
    transparency: number
    explainability: number
    compliance: number
    privacy: number
    ethics: number
    safety: number
    evidenceCoverage: number
    overall: number
  }
  safetyFlags: string[]
  cognitiveTrace: Array<{ step: string; detail: string; risk?: string }>
  dna: string[]
  documentHealthSummary?: {
    averageReliability: number
    outdated: number
    duplicates: number
    weak: number
  }
}

export type HallucinationSeverity = "low" | "medium" | "high" | "critical"

export interface SafetyClaimResult {
  id: string
  claim: string
  evidenceFound: boolean
  retrievedDocument?: string
  page?: number
  section?: string
  paragraph?: string
  similarity: number
  confidence: number
  verdict: "supported" | "unsupported" | "contradiction" | "rewritten"
  status: SpanStatus
  /** Chapter 2 — Claim Intelligence (optional, additive). */
  category?: string
  supportStatus?: string
  investigationStatus?: string
  namedEntities?: string[]
  numericalValues?: string[]
  dates?: string[]
  legalSections?: string[]
  medicalTerms?: string[]
  policyReferences?: string[]
  decomposedFromComposite?: boolean
}

export interface SafetyPlatformReport {
  rawLlmResponse: string
  verifiedResponse: string
  retrievedEvidence: Array<{
    documentName: string
    page: number
    section?: string
    paragraph: string
    similarity: number
    docId?: string
  }>
  claims: SafetyClaimResult[]
  evidenceStrength: {
    supportingDocuments: number
    contradictions: number
    evidenceCoverage: number
    evidenceStrengthPercent: number
    details: string[]
  }
  extendedTrust: {
    evidenceScore: number
    similarityScore: number
    retrievalScore: number
    reasoningScore: number
    freshnessScore: number
    consistencyScore: number
    finalTrustScore: number
    breakdown: string[]
  }
  governance: {
    transparency: number
    explainability: number
    ethics: number
    compliance: number
    evidenceCoverage: number
    governancePercent: number
    breakdown: string[]
  }
  ethics: {
    level: "safe" | "warning" | "critical"
    privacyRisk: string
    biasRisk: string
    complianceRisk: string
    medicalSafetyRisk: string
    legalComplianceRisk: string
    sensitiveLeakage: string
    flags: string[]
  }
  severity: HallucinationSeverity
  domainRisk: { domain: string; label: string; level: string }
  decisionTimeline: Array<{ step: string; detail: string }>
  reasonBullets: string[]
}

export interface AuditEntry extends FirewallResult {
  id: string
  timestamp: string
  domain: Domain
}

export interface SSEEvent {
  stage:
    | "received"
    | "domain_detection"
    | "prompt_security"
    | "conflict_check"
    | "llm_response"
    | "claim_extraction"
    | "evidence_matching"
    | "ethics_check"
    | "fact_check"
    | "confidence_score"
    | "reliability"
    | "decision"
    | "final_response"
    | "error"
    // Phase 2 — extended stages
    | "claim_verification_update"
    | "numeric_check"
    | "date_check"
    | "entity_check"
    | "domain_verification"
    | "rewrite_started"
    | "rewrite_complete"
    | "reverification"
    | "firewall_disabled"
    | "firewall_bypassed"
  data: Record<string, unknown>
}

// ─── Consistency check result types (surfaced in SSE + forensic view) ───────

export type NumericCheckStatus = "pass" | "mismatch" | "missing" | "not_applicable"
export type DateCheckStatus = "pass" | "mismatch" | "missing" | "not_applicable"
export type EntityCheckStatus = "pass" | "mismatch" | "missing" | "not_applicable"

export interface ClaimConsistencyChecks {
  numeric: {
    status: NumericCheckStatus
    note: string
    claimValues?: string[]
    evidenceValues?: string[]
  }
  date: {
    status: DateCheckStatus
    note: string
    claimDates?: string[]
    evidenceDates?: string[]
  }
  entity: {
    status: EntityCheckStatus
    note: string
    mismatches?: string[]
  }
  qualifier?: {
    status: "pass" | "mismatch" | "neutral"
    note: string
    claimQualifiers?: string[]
    evidenceQualifiers?: string[]
  }
}

export interface VerifiedClaim {
  claim: string
  status: "supported" | "unsupported" | "contradicted" | "uncertain"
  confidence: number
  evidenceSnippet?: string
  evidenceSource?: string
  consistencyChecks?: ClaimConsistencyChecks
  domainFlags?: string[]
}
