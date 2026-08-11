#!/usr/bin/env node
// self-play.mjs — Self-Play for edge-case discovery (cutting-edge technique #7)
// Generates DOMAIN-SPECIFIC adversarial edge cases by mapping concern domains to
// templates (not generic). The LLM determines applicability + fills specific tests.
// Usage: node scripts/self-play.mjs <feature-path> <domain1,domain2,...>
//   e.g. node scripts/self-play.mjs src/auth/ auth,api

const DOMAIN_EDGE_CASES = {
  auth: [
    { template: "Token expired mid-request", category: "race-condition" },
    { template: "User session invalidated by another tab", category: "state" },
    { template: "RBAC check passes but resource deleted between check and access", category: "race-condition" },
    { template: "Password reset link reused after first use", category: "replay" },
  ],
  billing: [
    { template: "Payment succeeds but webhook arrives after timeout", category: "race-condition" },
    { template: "Subscription cancelled during active trial", category: "state" },
    { template: "Refund requested for already-refunded charge", category: "idempotency" },
    { template: "Currency conversion rounding causes off-by-one", category: "boundary" },
  ],
  data: [
    { template: "Concurrent writes to same record", category: "concurrency" },
    { template: "Migration runs while traffic is live", category: "state" },
    { template: "Null value in required field", category: "boundary" },
    { template: "Foreign key references deleted parent", category: "integrity" },
  ],
  api: [
    { template: "Request body exceeds size limit", category: "boundary" },
    { template: "Rate limit hit mid-batch operation", category: "boundary" },
    { template: "External API returns partial success", category: "partial-failure" },
    { template: "Response schema changed without version bump", category: "compatibility" },
  ],
  ui: [
    { template: "Form submitted while previous submission is processing", category: "race-condition" },
    { template: "Modal opened while another modal is active", category: "state" },
    { template: "Network drops during optimistic update", category: "failure" },
    { template: "Screen reader encounters dynamically added content", category: "accessibility" },
  ],
};

function generateEdgeCases(featurePath, domains) {
  const edgeCases = [];
  for (const domain of domains) {
    const templates = DOMAIN_EDGE_CASES[domain] || [];
    for (const t of templates) {
      edgeCases.push({
        domain,
        ...t,
        applicable: true, // LLM confirms when generating tests
        test_case: null, // LLM fills the specific test
        priority: null, // 'must_test' | 'should_test' | 'nice_to_have'
      });
    }
  }
  return {
    ts: new Date().toISOString(),
    feature: featurePath,
    concern_domains: domains,
    known_domains: Object.keys(DOMAIN_EDGE_CASES),
    unmapped_domains: domains.filter((d) => !DOMAIN_EDGE_CASES[d]),
    total_edge_cases: edgeCases.length,
    edge_cases: edgeCases,
  };
}

const featurePath = process.argv[2];
const domains = (process.argv[3] || "").split(",").filter(Boolean);
if (!featurePath) {
  console.error("Usage: self-play.mjs <feature-path> <domain1,domain2,...>  (domains: " + Object.keys(DOMAIN_EDGE_CASES).join(",") + ")");
  process.exit(1);
}
console.log(JSON.stringify(generateEdgeCases(featurePath, domains), null, 2));
