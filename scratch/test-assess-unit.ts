import { assessEvidenceUnit } from "../lib/evidence-intelligence/assess";
import { refineToEvidenceSentences } from "../lib/evidence-intelligence/refine";

const claimObj: any = {
  id: "claim-1",
  originalClaim: "Under the Quantum Flux Limitation Protocol, all temporal claims are restricted to 42 sub-cycles per fiscal year.",
  namedEntities: ["Under", "Quantum Flux Limitation Protocol"],
  policyReferences: [],
  legalSections: [],
  numericalValues: ["42"],
  category: "numerical",
  dates: [],
  medicalTerms: ["Limitation Protocol"],
};

const chunkText = `[File: Constitution Of India.csv | Row 418] Articles: 357. Exercise of legislative powers under Proclamation issued under Article 356
(1) Whereby a Proclamation issued under clause ( 1 ) of Article 356, it has been declared that the powers of the Legislature of the State shall be exercisable by or under the authority of Parliament, it shall be competent
(a) for Parliament to confer on the President`;

const sentences = refineToEvidenceSentences(chunkText);
console.log("Sentences count:", sentences.length);

sentences.forEach((sentence, idx) => {
  const unit = assessEvidenceUnit({
    claim: claimObj,
    sentence,
    documentName: "Constitution Of India.csv",
    chunkSimilarity: 0.8,
    firewallDomain: "legal",
    unitIndex: idx,
  });
  console.log(`Unit ${idx}:`, {
    text: sentence.slice(0, 60),
    relation: unit.relation,
    rejected: unit.rejected,
    relevance: unit.relevance,
    reason: unit.reason,
  });
});
