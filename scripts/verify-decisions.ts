import { adjustScoreForClaims, hasNumericContradiction } from "../lib/claims"
import { makeDecision, scoreConfidence } from "../lib/firewall"

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`OK: ${msg}`)
}

assert(
  hasNumericContradiction("Data is retained for 3 years.", "retained for seven years"),
  "legal 3y vs 7y contradicted"
)
assert(
  !hasNumericContradiction(
    "Senior employees receive 20 PTO days.",
    "Senior employees receive 20 paid time-off days"
  ),
  "HR 20 days matches"
)
assert(
  hasNumericContradiction(
    "Q3 revenue was 6.8 million.",
    "Q3 2024 recognized revenue was 4.2 million"
  ),
  "finance 6.8 vs 4.2 contradicted"
)

const boosted = adjustScoreForClaims(
  0.4,
  "Senior employees get 20 days.",
  "Senior employees receive 20 paid time-off days annually."
)
assert(boosted.score >= 0.88 && !boosted.contradicted, "matching numbers boost to safe")

const penalized = adjustScoreForClaims(
  0.7,
  "Revenue was 6.8 million.",
  "revenue was 4.2 million US dollars"
)
assert(penalized.score <= 0.35 && penalized.contradicted, "conflicting finance numbers penalized")

assert(
  makeDecision(0.9, 0.9, "hr", {
    contradictionCount: 0,
    kbCoverage: true,
    hallucinatedRatio: 0,
  }) === "pass",
  "HR grounded -> pass"
)
assert(
  makeDecision(0.45, 0.5, "legal", {
    contradictionCount: 1,
    kbCoverage: true,
    hallucinatedRatio: 0.5,
  }) === "rewrite",
  "Legal contradiction + KB -> rewrite"
)
assert(
  makeDecision(0.3, 0.3, "finance", {
    contradictionCount: 1,
    kbCoverage: true,
    hallucinatedRatio: 0.8,
  }) === "block",
  "Finance contradiction -> block"
)

assert(scoreConfidence(0.85, 0, 3, 0) >= 0.7, "high confidence when all safe")
console.log("ALL DECISION ENGINE CHECKS PASSED")
