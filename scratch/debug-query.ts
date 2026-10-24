import fetch from "node-fetch";

async function test() {
  const res = await fetch("http://localhost:3000/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "What is the Quantum Flux Limitation Protocol under the Constitution of India?",
      domain: "legal",
      firewallEnabled: true,
      rawLlmResponse: "Under the Quantum Flux Limitation Protocol, all temporal claims are restricted to 42 sub-cycles per fiscal year.",
      docId: "0f7be5e4-12c9-438a-99b0-d1d74634d3ba",
      datasetId: "0f7be5e4-12c9-438a-99b0-d1d74634d3ba",
    }),
  });

  const text = await res.text();
  console.log("Response text length:", text.length);
  const lines = text.split("\n").filter((l) => l.startsWith("data: "));
  for (const l of lines) {
    try {
      const parsed = JSON.parse(l.slice(6));
      console.log("Stage:", parsed.stage, parsed.data?.decision || "");
      if (parsed.stage === "fact_check") {
        console.log("FACT CHECK CLAIMS:", parsed.data?.claims);
      }
      if (parsed.stage === "final_response") {
        console.log("FINAL RESPONSE CLAIMS:", parsed.data?.claims);
        console.log("DECISION:", parsed.data?.decision);
      }
      if (parsed.stage === "error") {
        console.log("ERROR EVENT:", parsed.data);
      }
    } catch (e) {
      console.log("Parse err:", l.slice(0, 100));
    }
  }
}

test().catch(console.error);
