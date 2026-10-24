import fs from 'node:fs';
import path from 'node:path';
import { readEvaluations, writeEvaluations, EvaluationRecord, EvaluationResult, Decision, VerificationStatus } from '../lib/evaluation_engine';
import http from 'node:http';

async function fetchFromFirewall(query: string, domain: string, rawResponse: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            query,
            domain,
            rawLlmResponse: rawResponse,
            firewallEnabled: true
        });

        const options = {
            hostname: '127.0.0.1',
            port: 3000,
            path: '/api/query',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let buffer = '';
            let finalDecision: string | null = null;
            let finalClaims: any[] = [];
            let evidenceRetrieved = false;
            let retrievedDocNames: string[] = [];

            res.on('data', (chunk) => {
                buffer += chunk.toString();
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || ''; // Keep incomplete part
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            if (data.stage === 'evidence_matching' && data.data?.retrievedEvidence?.length > 0) {
                                evidenceRetrieved = true;
                                retrievedDocNames = data.data.retrievedEvidence.map((e: any) => e.documentName || e.datasetName || e.sourceFile || '');
                            }
                            if (data.stage === 'claim_extraction' && data.data?.status === 'complete') {
                                finalClaims = data.data.claims || [];
                            }
                            if (data.stage === 'final_response' || data.stage === 'decision') {
                                // Sometimes decision comes earlier or in final_response
                                if (data.data?.decision) {
                                    finalDecision = data.data.decision;
                                } else if (data.data?.explanation?.statusText) {
                                     // Fallback inference if decision string isn't directly exposed
                                     const status = data.data.explanation.statusText.toLowerCase();
                                     if (status.includes('block')) finalDecision = 'block';
                                     else if (status.includes('rewrite') || status.includes('recover')) finalDecision = 'rewrite';
                                     else if (status.includes('pass') || status.includes('clear')) finalDecision = 'pass';
                                }
                            }
                        } catch (e) {
                            // ignore parse errors for partial chunks
                        }
                    }
                }
            });

            res.on('end', () => {
                resolve({
                    decision: finalDecision || 'pass',
                    claims: finalClaims,
                    evidenceRetrieved,
                    retrievedDocNames
                });
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(postData);
        req.end();
    });
}

async function runEvaluations() {
    console.log("Starting Evaluation Run...");
    const records = readEvaluations();
    let updated = 0;

    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        console.log(`Evaluating [${i+1}/${records.length}]: ${record.testCase.id}`);
        const startTime = Date.now();
        
        try {
            // We simulate the firewall execution
            // Note: Ensure the Next.js dev server is running on port 3000!
            const fwResult = await fetchFromFirewall(record.testCase.question, record.testCase.domain, record.testCase.rawResponse).catch(err => null);
            
            if (!fwResult) {
                console.log(`  [Warning] Firewall server unreachable. Skipping ${record.testCase.id}`);
                record.result = null;
                continue;
            }

            // Call again to check consistency
            const fwResult2 = await fetchFromFirewall(record.testCase.question, record.testCase.domain, record.testCase.rawResponse).catch(err => null);
            
            const latencyMs = Date.now() - startTime;
            
            let actualDecision: Decision = fwResult.decision as Decision;
            let evidenceRetrieved = false;
            
            if (record.testCase.expectedEvidence && record.testCase.expectedEvidence.length > 0) {
               // Validate actualEvidenceRetrieved by matching expected document names
               evidenceRetrieved = fwResult.retrievedDocNames.some((name: string) => 
                   record.testCase.expectedEvidence.some(expected => name.toLowerCase().includes(expected.toLowerCase()) || expected.toLowerCase().includes(name.toLowerCase()))
               );
            } else {
               evidenceRetrieved = fwResult.evidenceRetrieved;
            }

            let actualStatus: VerificationStatus = 'supported';
            const hasContradicted = fwResult.claims?.some((c: any) => c.supportStatus === 'contradicted');
            const hasUnsupported = fwResult.claims?.some((c: any) => c.supportStatus === 'unsupported');
            const hasPartial = fwResult.claims?.some((c: any) => c.supportStatus === 'partially_supported');
            
            if (hasContradicted) actualStatus = 'contradicted';
            else if (hasUnsupported) actualStatus = 'unsupported';
            else if (hasPartial) actualStatus = 'partially_supported';
            
            let isConsistent = true;
            if (fwResult2) {
                isConsistent = (fwResult.decision === fwResult2.decision);
            }

            const result: EvaluationResult = {
                caseId: record.testCase.id,
                actualDecision,
                actualVerificationStatus: actualStatus,
                actualEvidenceRetrieved: evidenceRetrieved,
                isConsistent,
                latencyMs: Math.round(latencyMs / 2) // avg latency per query
            };

            record.result = result;
            updated++;
            
            console.log(`  Expected: ${record.testCase.expectedDecision} | Actual: ${actualDecision} | Avg Latency: ${result.latencyMs}ms`);
            
        } catch (error) {
            console.error(`  Error evaluating ${record.testCase.id}:`, error);
        }
    }

    if (updated > 0) {
        writeEvaluations(records);
        console.log(`\nEvaluation complete. Updated ${updated} records in simulation-evaluations.json.`);
    }
}

runEvaluations().catch(console.error);
