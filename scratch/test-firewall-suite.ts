import fetch from "node-fetch";

async function runQuery(body: any) {
  const res = await fetch("http://localhost:3000/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  const lines = text.split("\n");
  const events: any[] = [];
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      try {
        events.push(JSON.parse(line.slice(6)));
      } catch (e) {}
    }
  }

  const finalEvent = events.find((e) => e.stage === "final_response")?.data;
  const decisionEvent = events.find((e) => e.stage === "decision")?.data;
  return { finalEvent, decisionEvent, events };
}

async function runSuite() {
  console.log("=== STARTING HALLUCINATION FIREWALL COMPREHENSIVE TEST SUITE ===");
  const docsRes = await fetch("http://localhost:3000/api/docs");
  const allDocs = (await docsRes.json()) as any[];
  const legalDoc = allDocs.find((d) => d.domain === "legal" && (d.title?.includes("Constitution") || d.filename?.includes("Constitution") || d.title?.includes("Dataset")));
  const legalDocId = legalDoc?.id || "0f7be5e4-12c9-438a-99b0-d1d74634d3ba";
  const hospitalDoc = allDocs.find((d) => d.domain === "healthcare");
  const hospitalDocId = hospitalDoc?.id || "328f793c-4644-412d-998e-09edd2f84109";
  console.log(`Active Legal Doc: ${legalDoc?.title || legalDocId} (${legalDocId})`);
  console.log(`Active Healthcare Doc: ${hospitalDoc?.title || hospitalDocId} (${hospitalDocId})`);

  // ─────────────────────────────────────────────────────────────
  // TEST 1 — CORRECT: Article 21
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- TEST 1: Correct Article 21 (PASS, ON=OFF) ---");
  const test1Raw =
    "Article 21 of the Constitution of India provides for the protection of life and personal liberty. No person shall be deprived of his life or personal liberty except according to procedure established by law.";
  const q1 = "Which article of the Indian Constitution protects life and personal liberty?";

  console.log("1a. Running Firewall OFF...");
  const t1Off = await runQuery({
    query: q1,
    domain: "legal",
    firewallEnabled: false,
    rawLlmResponse: test1Raw,
    docId: legalDocId,
    datasetId: legalDocId,
  });

  console.log("1b. Running Firewall ON with SAME raw...");
  const t1On = await runQuery({
    query: q1,
    domain: "legal",
    firewallEnabled: true,
    rawLlmResponse: test1Raw,
    docId: legalDocId,
    datasetId: legalDocId,
  });

  console.log("Test 1 OFF Decision:", t1Off.finalEvent?.decision);
  console.log("Test 1 OFF Displayed:", t1Off.finalEvent?.displayedResponse?.slice(0, 80) + "...");
  console.log("Test 1 ON Decision:", t1On.finalEvent?.decision);
  console.log("Test 1 ON Displayed:", t1On.finalEvent?.displayedResponse?.slice(0, 80) + "...");
  const t1Pass =
    t1On.finalEvent?.decision === "pass" &&
    t1On.finalEvent?.displayedResponse === test1Raw &&
    t1Off.finalEvent?.displayedResponse === test1Raw;
  console.log("TEST 1 RESULT:", t1Pass ? "✅ PASS (ON text identical to OFF text, no rewrite)" : "❌ FAIL");

  // ─────────────────────────────────────────────────────────────
  // TEST 2 — WRONG: Forced Article 32 vs Article 21 in KB
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- TEST 2: Wrong Article 32 (REWRITE, ON≠OFF) ---");
  const test2Raw = "Article 32 guarantees the Right to Life and Personal Liberty in India.";

  console.log("2a. Running Firewall OFF...");
  const t2Off = await runQuery({
    query: q1,
    domain: "legal",
    firewallEnabled: false,
    rawLlmResponse: test2Raw,
    docId: legalDocId,
    datasetId: legalDocId,
  });

  console.log("2b. Running Firewall ON with SAME wrong raw...");
  const t2On = await runQuery({
    query: q1,
    domain: "legal",
    firewallEnabled: true,
    rawLlmResponse: test2Raw,
    docId: legalDocId,
    datasetId: legalDocId,
  });

  console.log("Test 2 OFF Decision:", t2Off.finalEvent?.decision);
  console.log("Test 2 OFF Displayed (Wrong):", t2Off.finalEvent?.displayedResponse);
  console.log("Test 2 ON Decision:", t2On.finalEvent?.decision);
  console.log("Test 2 ON Displayed (Corrected):", t2On.finalEvent?.displayedResponse);
  console.log("Test 2 ON Raw Recorded:", t2On.finalEvent?.rawLlmResponse);

  const t2Pass =
    t2Off.finalEvent?.displayedResponse === test2Raw &&
    t2On.finalEvent?.decision === "rewrite" &&
    t2On.finalEvent?.displayedResponse !== test2Raw &&
    /21/i.test(t2On.finalEvent?.displayedResponse || "");
  console.log("TEST 2 RESULT:", t2Pass ? "✅ PASS (Wrong raw displayed on OFF; corrected to Article 21 on ON)" : "❌ FAIL");

  // ─────────────────────────────────────────────────────────────
  // TEST 3 — UNSUPPORTED: Question not in selected KB
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- TEST 3: Unsupported Question (BLOCK, ON) ---");
  const q3 = "What is the Quantum Flux Limitation Protocol under the Constitution of India?";
  const test3Raw =
    "Under the Quantum Flux Limitation Protocol, all temporal claims are restricted to 42 sub-cycles per fiscal year.";

  console.log("3a. Running Firewall OFF...");
  const t3Off = await runQuery({
    query: q3,
    domain: "legal",
    firewallEnabled: false,
    rawLlmResponse: test3Raw,
    docId: legalDocId,
    datasetId: legalDocId,
  });

  console.log("3b. Running Firewall ON...");
  const t3On = await runQuery({
    query: q3,
    domain: "legal",
    firewallEnabled: true,
    rawLlmResponse: test3Raw,
    docId: legalDocId,
    datasetId: legalDocId,
  });

  console.log("Test 3 OFF Decision:", t3Off.finalEvent?.decision);
  console.log("Test 3 OFF Displayed (Invented):", t3Off.finalEvent?.displayedResponse);
  console.log("Test 3 ON Decision:", t3On.finalEvent?.decision);
  console.log("Test 3 ON Displayed:", t3On.finalEvent?.displayedResponse);

  const t3Pass =
    t3Off.finalEvent?.displayedResponse === test3Raw &&
    t3On.finalEvent?.decision === "block";
  console.log("TEST 3 RESULT:", t3Pass ? "✅ PASS (Invented text on OFF; blocked with safe message on ON)" : "❌ FAIL");

  // ─────────────────────────────────────────────────────────────
  // TEST 4 — DATASET ISOLATION
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- TEST 4: Dataset Isolation ---");
  console.log("4a. Querying with legalDocId...");
  const t4Legal = await runQuery({
    query: q1,
    domain: "legal",
    firewallEnabled: true,
    rawLlmResponse: test1Raw,
    docId: legalDocId,
    datasetId: legalDocId,
  });

  const legalSources = t4Legal.finalEvent?.sourcesUsed || [];
  console.log("Legal Sources Count:", legalSources.length);
  console.log("Legal Sources Sample:", legalSources.slice(0, 2));

  console.log("4b. Querying with healthcare docId...");
  const t4Health = await runQuery({
    query: "How many ICU beds are available?",
    domain: "healthcare",
    firewallEnabled: true,
    docId: hospitalDocId,
    datasetId: hospitalDocId,
  });

  const healthSources = t4Health.finalEvent?.sourcesUsed || [];
  console.log("Hospital Sources Count:", healthSources.length);
  console.log("Hospital Sources Sample:", healthSources.slice(0, 2));

  const hasCrossPollution = legalSources.some((s: string) => /hospital|icu|bed/i.test(s));
  const t4Pass = !hasCrossPollution && legalSources.length > 0;
  console.log("TEST 4 RESULT:", t4Pass ? "✅ PASS (Strict dataset isolation enforced; no mixing)" : "❌ FAIL");

  // ─────────────────────────────────────────────────────────────
  // TEST 5 — MISSING DATASET WHEN FIREWALL ON
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- TEST 5: Missing Dataset Selection When Firewall ON ---");
  const t5 = await runQuery({
    query: q1,
    domain: "legal",
    firewallEnabled: true,
    rawLlmResponse: test1Raw,
  });
  console.log("Test 5 Decision:", t5.finalEvent?.decision);
  console.log("Test 5 Displayed:", t5.finalEvent?.displayedResponse);
  const t5Pass =
    t5.finalEvent?.decision === "block" &&
    t5.finalEvent?.displayedResponse?.includes("Select a Knowledge Base document/dataset first");
  console.log("TEST 5 RESULT:", t5Pass ? "✅ PASS (Blocked with prompt to select KB first)" : "❌ FAIL");

  console.log("\n=== ALL TEST RESULTS ===");
  console.log("Test 1 (Correct, PASS, ON=OFF):", t1Pass ? "PASS ✅" : "FAIL ❌");
  console.log("Test 2 (Wrong, REWRITE, ON≠OFF):", t2Pass ? "PASS ✅" : "FAIL ❌");
  console.log("Test 3 (Unsupported, BLOCK):", t3Pass ? "PASS ✅" : "FAIL ❌");
  console.log("Test 4 (Dataset Isolation):", t4Pass ? "PASS ✅" : "FAIL ❌");
  console.log("Test 5 (Missing Dataset Check):", t5Pass ? "PASS ✅" : "FAIL ❌");
}

runSuite().catch(console.error);
