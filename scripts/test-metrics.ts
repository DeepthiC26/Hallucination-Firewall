import assert from 'node:assert';
import { getEvaluationMetrics, EvaluationMetricsSummary, writeEvaluations, readEvaluations } from '../lib/evaluation_engine';

function assertEqual(actual: any, expected: any, message: string) {
    if (actual !== expected) {
        throw new Error(`${message}: Expected ${expected}, got ${actual}`);
    }
}

function assertClose(actual: any, expected: any, message: string, delta = 0.0001) {
    if (actual === null || expected === null) {
        assertEqual(actual, expected, message);
        return;
    }
    if (Math.abs(actual - expected) > delta) {
        throw new Error(`${message}: Expected ${expected}, got ${actual}`);
    }
}

async function testMetrics() {
    console.log("Running Metric Math Tests...");
    
    // Backup existing data if any
    const originalData = readEvaluations();
    
    try {
        // Test 1: Empty Dataset
        writeEvaluations([]);
        let metrics = getEvaluationMetrics();
        assertEqual(metrics.status, 'NO_DATA', 'Empty dataset should return NO_DATA');
        assertEqual(metrics.accuracy, null, 'Accuracy should be null for empty data');
        
        // Test 2: Perfectly accurate dataset
        writeEvaluations([
            {
                testCase: { id: "1", domain: "enterprise", question: "", rawResponse: "", expectedStatus: "supported", expectedDecision: "pass", expectedClaims: [], expectedEvidence: [] },
                result: { caseId: "1", actualDecision: "pass", actualVerificationStatus: "supported", actualEvidenceRetrieved: true, isConsistent: true, latencyMs: 100 }
            },
            {
                testCase: { id: "2", domain: "enterprise", question: "", rawResponse: "", expectedStatus: "contradicted", expectedDecision: "rewrite", expectedClaims: [], expectedEvidence: [] },
                result: { caseId: "2", actualDecision: "rewrite", actualVerificationStatus: "contradicted", actualEvidenceRetrieved: true, isConsistent: true, latencyMs: 100 }
            }
        ]);
        metrics = getEvaluationMetrics();
        assertEqual(metrics.accuracy, 1.0, 'Accuracy should be 100%');
        assertEqual(metrics.classes.pass.precision, 1.0, 'Pass precision should be 100%');
        assertEqual(metrics.classes.pass.recall, 1.0, 'Pass recall should be 100%');
        
        // Test 3: Mixed dataset (1 TP, 1 FP, 1 FN, 1 TN mapping to a binary or multiclass setup)
        // Let's test the specific math for Accuracy = 75%
        writeEvaluations([
            {
                testCase: { id: "1", domain: "enterprise", question: "", rawResponse: "", expectedStatus: "supported", expectedDecision: "pass", expectedClaims: [], expectedEvidence: [] },
                result: { caseId: "1", actualDecision: "pass", actualVerificationStatus: "supported", actualEvidenceRetrieved: true, isConsistent: true, latencyMs: 100 } // Correct
            },
            {
                testCase: { id: "2", domain: "enterprise", question: "", rawResponse: "", expectedStatus: "unsupported", expectedDecision: "block", expectedClaims: [], expectedEvidence: [] },
                result: { caseId: "2", actualDecision: "block", actualVerificationStatus: "unsupported", actualEvidenceRetrieved: false, isConsistent: true, latencyMs: 100 } // Correct
            },
            {
                testCase: { id: "3", domain: "enterprise", question: "", rawResponse: "", expectedStatus: "contradicted", expectedDecision: "rewrite", expectedClaims: [], expectedEvidence: [] },
                result: { caseId: "3", actualDecision: "pass", actualVerificationStatus: "supported", actualEvidenceRetrieved: false, isConsistent: false, latencyMs: 100 } // Incorrect (FN for rewrite, FP for pass)
            },
            {
                testCase: { id: "4", domain: "enterprise", question: "", rawResponse: "", expectedStatus: "supported", expectedDecision: "pass", expectedClaims: [], expectedEvidence: [] },
                result: { caseId: "4", actualDecision: "pass", actualVerificationStatus: "supported", actualEvidenceRetrieved: true, isConsistent: true, latencyMs: 100 } // Correct
            }
        ]);
        
        metrics = getEvaluationMetrics();
        assertEqual(metrics.accuracy, 0.75, 'Accuracy should be 75%');
        
        // Expected PASS: 2, Actual PASS: 3. Correct PASS: 2.
        // Precision = TP / (TP + FP) = 2 / 3 = 0.666...
        assertClose(metrics.classes.pass.precision, 0.6666, 'Pass precision should be 66.6%');
        
        // Recall = TP / (TP + FN) = 2 / 2 = 1.0
        assertEqual(metrics.classes.pass.recall, 1.0, 'Pass recall should be 100%');
        
        // Expected REWRITE: 1, Actual REWRITE: 0. Correct REWRITE: 0.
        // Precision = null or 0? 0 TP, 0 FP -> null because denominator is 0
        assertEqual(metrics.classes.rewrite.precision, null, 'Rewrite precision should be null (div by zero avoided)');
        
        // Recall = 0 TP / (0 TP + 1 FN) = 0
        assertEqual(metrics.classes.rewrite.recall, 0, 'Rewrite recall should be 0');

        console.log("All Math Tests Passed Successfully!");

    } finally {
        // Restore original data
        writeEvaluations(originalData);
    }
}

testMetrics().catch(e => {
    console.error("Test failed:", e.message);
    process.exit(1);
});
