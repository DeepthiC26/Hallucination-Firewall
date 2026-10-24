import { verifyClaimsWithEvidence } from "@/lib/safety/claims";
import { applyDecisionRules } from "@/lib/decision-intelligence/rules";

async function diagnose() {
  const q = "Which article of the Indian Constitution protects life and personal liberty?";
  const raw = "Article 21 of the Constitution of India provides for the protection of life and personal liberty. No person shall be deprived of his life or personal liberty except according to procedure established by law.";
  const docId = "f7740f74-85de-42d6-9084-df67a6edccdb";

  const verRes = await verifyClaimsWithEvidence({
    responseText: raw,
    query: q,
    domain: "legal",
    datasetId: docId,
    firewallDomain: "legal"
  });

  const ruleApp = applyDecisionRules({
    claims: verRes.claims,
    evidence: verRes.evidenceIntelligence,
    reasoning: verRes.reasoningIntelligence,
    stages: [],
    firewallDomain: "legal",
    ethics: { level: "low", privacyRisk: "low", sensitiveLeakage: "low" } as any,
    conflictsCount: 0,
    confidenceScore: 0.95,
    kbCoverage: true,
    recoveryPossible: true
  });

  console.log("Decision rules output:", ruleApp.decision);
  console.log("Reason:", ruleApp.reason);
  console.log("Rules fired:", ruleApp.rulesFired);
}

diagnose().catch(console.error);
