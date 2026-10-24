import { verifyClaimsWithEvidence } from "../lib/safety/claims";
import { runInvestigationPipeline } from "../lib/decision-validation/investigation_pipeline";

async function main() {
  const query = "What is the Quantum Flux Limitation Protocol under the Constitution of India?";
  const raw = "Under the Quantum Flux Limitation Protocol, all temporal claims are restricted to 42 sub-cycles per fiscal year.";
  const datasetId = "f7740f74-85de-42d6-9084-df67a6edccdb";

  const res = await verifyClaimsWithEvidence({
    responseText: raw,
    query,
    domain: "legal",
    datasetId,
    firewallDomain: "legal",
  });

  console.log("Claims extracted & verified:");
  for (const c of res.claims) {
    console.log({
      id: c.id,
      claim: c.claim,
      supportStatus: c.supportStatus,
      verdict: c.verdict,
      evidenceFound: c.evidenceFound,
      similarity: c.similarity,
      paragraph: c.paragraph?.slice(0, 80),
    });
  }

  const investigation = await runInvestigationPipeline({
    query,
    rawAnswer: raw,
    claims: res.claims,
    kbMatches: [],
    conflicts: [],
    firewallDomain: "legal",
    domainVerification: { verified: false, details: [] },
    ethics: { level: "low", privacyRisk: "none", sensitiveLeakage: "none" } as any,
    freshness: { freshnessScore: 1, outdatedDocs: [], preferredDocs: [] } as any,
    medicalUnsafe: false,
    sources: [],
    confidenceScore: 0.1,
    evidenceIntelligence: res.evidenceIntelligence,
    reasoningIntelligence: res.reasoningIntelligence,
  });

  console.log("Investigation decision:", investigation.decision);
  console.log("Investigation reason:", investigation.decisionEngineReason);
  console.log("Investigation finalResponse:", investigation.finalResponse);
}

main().catch(console.error);
