import { factCheck, makeDecision, scoreConfidence } from "../lib/firewall"

async function runCase(
  name: string,
  query: string,
  domain: "legal" | "hr" | "finance",
  llmResponse: string,
  expected: "pass" | "rewrite" | "block"
) {
  const result = await factCheck(llmResponse, query, domain)
  const numHallucinated = result.flaggedSpans.filter((s) => s.status === "hallucinated").length
  const confidence = scoreConfidence(
    result.factScore,
    numHallucinated,
    result.flaggedSpans.length,
    result.contradictionCount
  )
  const decision = makeDecision(result.factScore, confidence, domain, {
    contradictionCount: result.contradictionCount,
    kbCoverage: result.kbCoverage,
    hallucinatedRatio:
      result.flaggedSpans.length > 0 ? numHallucinated / result.flaggedSpans.length : 1,
  })

  console.log(`\n=== ${name} ===`)
  console.log("factScore:", result.factScore, "confidence:", confidence)
  console.log("contradictions:", result.contradictionCount, "kbCoverage:", result.kbCoverage)
  console.log(
    "spans:",
    result.flaggedSpans.map((s) => `${s.status}@${s.score}`).join(", ")
  )
  console.log("decision:", decision, "| expected:", expected)

  if (decision !== expected) {
    throw new Error(`${name}: expected ${expected}, got ${decision}`)
  }
  console.log("OK")
}

async function main() {
  await runCase(
    "PASS — HR PTO",
    "How many PTO days do senior employees get?",
    "hr",
    "Senior employees receive 20 paid time-off days annually according to policy.",
    "pass"
  )

  await runCase(
    "REWRITE — Legal retention",
    "What is our data retention period?",
    "legal",
    "Our company retains customer data for 3 years from collection.",
    "rewrite"
  )

  await runCase(
    "BLOCK — Finance revenue",
    "What was Q3 2024 recognized revenue?",
    "finance",
    "Q3 2024 recognized revenue was 6.8 million US dollars.",
    "block"
  )

  console.log("\nALL PIPELINE SCENARIO CHECKS PASSED")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
