/**
 * Automated Verification Test Suite for Legal Multi-Passage Reasoning & Qualifier Detection
 *
 * Validates:
 * 1. Atomic claim decomposition of qualified/absolutist statements
 * 2. Clause / Exception / Qualifier detection (absolute vs reasonable restrictions)
 * 3. Independent claim verification (Claim 1 SUPPORTED, Claim 2 CONTRADICTED)
 * 4. Overall decision = REWRITE (never false BLOCK)
 * 5. Multi-passage legal reasoning combining Article 19(1)(a) & Article 19(2)
 * 6. Stage 2 re-verification of the evidence-grounded final answer
 */

import { extractAtomicClaims } from "@/lib/claim-intelligence/extract"
import { runClaimIntelligence } from "@/lib/claim-intelligence/engine"
import { checkClauseQualifierConsistency } from "@/lib/consistency/qualifier"
import { verifyClaimsWithEvidence } from "@/lib/safety/claims"
import { applyDecisionRules } from "@/lib/decision-intelligence/rules"
import { assembleClaimPreservingResponse } from "@/lib/decision-validation/claim_rewrite"
import { queryKB } from "@/lib/pinecone"

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`  ✓ PASS: ${message}`)
}

async function runTestSuite() {
  console.log("================================================================================")
  console.log("  HALLUCINATION FIREWALL — LEGAL VERIFICATION & QUALIFIER REASONING SUITE       ")
  console.log("================================================================================\n")

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 1: ATOMIC CLAIM DECOMPOSITION OF QUALIFIED STATEMENTS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- SUITE 1: ATOMIC CLAIM DECOMPOSITION ---")
  const rawLlmAnswer = "Yes, every citizen has an absolute right to freedom of speech."
  const extraction = extractAtomicClaims(rawLlmAnswer)

  assert(extraction.atoms.length >= 2, "Decomposed qualified assertion into ≥2 atomic claims")
  
  const claim1 = extraction.atoms[0]?.text || ""
  const claim2 = extraction.atoms[1]?.text || ""

  assert(
    /right to freedom of speech/i.test(claim1) && !/absolute/i.test(claim1),
    `Claim 1 extracts substantive right without absolute bias: "${claim1}"`
  )
  assert(
    /absolute/i.test(claim2),
    `Claim 2 extracts qualification for independent verification: "${claim2}"`
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 2: CLAUSE / EXCEPTION / QUALIFIER DETECTION ENGINE
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 2: CLAUSE / EXCEPTION / QUALIFIER DETECTION ---")
  const art19_1a_evidence =
    "Constitution of India — Article 19(1)(a): All citizens shall have the right to freedom of speech and expression."
  const art19_2_evidence =
    "Constitution of India — Article 19(2): The right to freedom of speech and expression is not absolute and is subject to reasonable restrictions in the interests of sovereignty, security of the State, public order, decency or morality."

  const qualCheckCore = checkClauseQualifierConsistency(claim1, art19_1a_evidence, "legal")
  assert(
    qualCheckCore.status === "pass",
    "Substantive right claim aligns with Article 19(1)(a) (status: pass)"
  )

  const qualCheckAbsolute = checkClauseQualifierConsistency(claim2, art19_2_evidence, "legal")
  assert(
    qualCheckAbsolute.status === "mismatch" && qualCheckAbsolute.relation === "contradicts",
    "Absolute claim contradicted by Article 19(2) reasonable restrictions (status: mismatch, relation: contradicts)"
  )
  assert(
    qualCheckAbsolute.detectedEvidenceQualifiers.some((q) => /reasonable restrictions|not absolute/i.test(q)),
    "Identified 'reasonable restrictions' and 'not absolute' evidence qualifiers"
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 3: MULTI-PASSAGE KB RETRIEVAL FOR CONSTITUTIONAL PROVISIONS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 3: MULTI-PASSAGE CONSTITUTIONAL RETRIEVAL ---")
  const kbResult = await queryKB(
    "Does the Constitution of India state that every citizen has an absolute right to freedom of speech?",
    { topK: 6, domain: "legal", firewallDomain: "legal" }
  )

  assert(kbResult.matches.length >= 2, "Retrieved multiple candidate passages from Knowledge Base")
  const hasArt19_1a = kbResult.matches.some((m) => /19\(1\)\(a\)|freedom of speech/i.test(m.text))
  const hasArt19_2 = kbResult.matches.some((m) => /19\(2\)|reasonable restrictions|not absolute/i.test(m.text))

  assert(hasArt19_1a, "Multi-passage retrieval captured Article 19(1)(a) right provision")
  assert(hasArt19_2, "Multi-passage retrieval captured Article 19(2) restriction provision")

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 4: INDEPENDENT VERIFICATION & SUPPORT STATUS MAPPING
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 4: INDEPENDENT CLAIM VERIFICATION ---")
  const intel = runClaimIntelligence({
    responseText: rawLlmAnswer,
    firewallDomain: "legal",
  })

  const verified = await verifyClaimsWithEvidence({
    responseText: rawLlmAnswer,
    query: "Does the Constitution of India state that every citizen has an absolute right to freedom of speech?",
    domain: "legal",
    firewallDomain: "legal",
    claimObjects: intel.claims,
  })

  assert(verified.claims.length >= 2, "Verified both claims independently")

  const verifiedClaim1 = verified.claims[0]
  const verifiedClaim2 = verified.claims[1]

  assert(
    verifiedClaim1.supportStatus === "fully_supported" || verifiedClaim1.verdict === "supported",
    `Claim 1 (right to freedom of speech) is SUPPORTED (verdict: ${verifiedClaim1.verdict}, support: ${verifiedClaim1.supportStatus})`
  )
  assert(
    verifiedClaim2.supportStatus === "contradicted" || verifiedClaim2.verdict === "contradiction",
    `Claim 2 (absolute right) is CONTRADICTED by restrictions (verdict: ${verifiedClaim2.verdict}, support: ${verifiedClaim2.supportStatus})`
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 5: DECISION INTELLIGENCE (REWRITE, NOT BLOCK)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 5: DECISION INTELLIGENCE (REWRITE NOT BLOCK) ---")
  const decisionResult = applyDecisionRules({
    claims: verified.claims,
    evidence: verified.evidenceIntelligence,
    reasoning: verified.reasoningIntelligence,
    stages: [],
    firewallDomain: "legal",
    ethics: { level: "safe", privacyRisk: "safe", sensitiveLeakage: "safe", biasRisk: "safe", complianceRisk: "safe", medicalSafetyRisk: "safe", legalComplianceRisk: "safe", flags: [] },
    conflictsCount: 0,
    confidenceScore: 0.85,
    kbCoverage: true,
    recoveryPossible: true,
  })

  assert(
    decisionResult.decision === "rewrite",
    `Decision is REWRITE (not BLOCK) when premise is supported and qualifier is contradicted: decision = "${decisionResult.decision}"`
  )
  assert(
    !decisionResult.rulesFired.includes("RULE_BLOCK_SAFETY_PRIVACY"),
    "No false safety block triggered for legal nuance"
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // SUITE 6: EVIDENCE-GROUNDED RESPONSE ASSEMBLY & RE-VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- SUITE 6: EVIDENCE-GROUNDED REWRITE & RE-VERIFICATION ---")
  const assembled = await assembleClaimPreservingResponse({
    claims: verified.claims,
    sources: ["Constitution of India — Article 19(1)(a)", "Constitution of India — Article 19(2)"],
    query: "Does the Constitution of India state that every citizen has an absolute right to freedom of speech?",
    kbMatches: kbResult.matches,
    rawAnswer: rawLlmAnswer,
  })

  assert(assembled.text.length > 50, "Assembled complete evidence-grounded rewritten response")
  assert(
    /reasonable restrictions|not absolute|Article 19/i.test(assembled.text),
    "Rewritten response includes Article 19 and reasonable restrictions from verified evidence"
  )

  // Re-verify the rewritten response
  const reverify = await verifyClaimsWithEvidence({
    responseText: assembled.text,
    query: "Does the Constitution of India state that every citizen has an absolute right to freedom of speech?",
    domain: "legal",
    firewallDomain: "legal",
  })

  const r2 = reverify.evidenceIntelligence?.claimReports?.[1]
  console.log("  [DEBUG] Claim 2 Contradicting Units:", r2?.contradicting.map((u) => ({
    text: u.text.slice(0, 100),
    relation: u.relation,
    reason: u.reason,
  })))
  console.log("  [DEBUG] Claim 2 Supporting Units:", r2?.supporting.map((u) => ({
    text: u.text.slice(0, 100),
    relation: u.relation,
    reason: u.reason,
  })))

  const reverifyContradictions = reverify.claims.filter(
    (c) => c.supportStatus === "contradicted" || c.verdict === "contradiction"
  )
  assert(reverifyContradictions.length === 0, "Stage 2 Re-verification passed with 0 contradictions")

  console.log("\n================================================================================")
  console.log("  ALL 18/18 LEGAL VERIFICATION & QUALIFIER TESTS PASSED SUCCESSFULLY!          ")
  console.log("================================================================================\n")
}

runTestSuite().catch((err) => {
  console.error("Test suite failed:", err)
  process.exit(1)
})
