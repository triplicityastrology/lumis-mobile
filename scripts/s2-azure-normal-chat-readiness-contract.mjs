import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const controlText = read("supabase/tests/s2-t195-azure-readiness-control.json");
const control = JSON.parse(controlText);
const manifest = JSON.parse(read("supabase/tests/s2-t195-source-checksum-manifest.json"));
const doc = read("docs/architecture/S2-T195-azure-normal-chat-readiness-approval.md");

assert.deepEqual(control.status, ["NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY"]);
assert.equal(control.source_authority_sha, "6ee57eaeec213df945b568449a1aedf7f7481aca");
assert.equal(control.confirmed_staging_facts.deployment_offering, "Global Standard");
assert.equal(control.confirmed_staging_facts.server_alias, "lumis-ai-chat-stg");
assert.equal(control.confirmed_staging_facts.normal_chat_adapter_connection, false);
assert.equal(control.confirmed_staging_facts.synthetic_only_required, true);
assert.equal(control.data_geography.singapore_or_apac_only_claim, false);
assert.equal(control.data_geography.regional_inference_claim, false);
assert.equal(control.abuse_monitoring.flagged_prompt_or_completion_human_review_possible, true);
assert.equal(control.safety.azure_filter_profile, "DefaultV2");
assert.equal(control.safety.azure_filter_replaces_lumis_policy, false);
assert.equal(control.safety.assistant_persistence, "none");
assert.equal(control.safety.units_charged, 0);
assert.equal(control.fallback.assistant_persistence, "none");
assert.equal(control.fallback.units_charged, 0);
assert.equal(control.telemetry.retention_days, 30);
assert.equal(control.telemetry.owner, "Technical Architect");
assert.equal(control.telemetry.metadata_only, true);

for (const closed of ["fallback", "safety", "telemetry", "DefaultV2", "content_filter"]) {
  assert(!control.unresolved_decisions.some((item) => item.toLowerCase().includes(closed.toLowerCase())), `${closed} incorrectly unresolved`);
}
for (const approval of control.approval_gates) assert.notEqual(approval.state, "approved");

for (const entry of manifest.files) {
  assert.match(entry.path, /^(apps|packages|supabase)\//);
  assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  assert.equal(createHash("sha256").update(read(entry.path)).digest("hex"), entry.sha256, `source checksum drift: ${entry.path}`);
}

for (const required of [
  "NO_NORMAL_CHAT_INTEGRATION_AUTHORITY", "NO_AZURE_TRAFFIC_AUTHORITY",
  "may be processed in any Azure geography", "not Singapore-only or APAC-only inference",
  "DefaultV2", "30 days", "Technical Architect", "monitoring only",
  control.safety.approved_copy, control.fallback.approved_copy
]) assert(doc.includes(required), `readiness packet missing ${required}`);

for (const prohibited of [/https?:\/\//i, /bearer\s+/i, /api[_-]?key\s*[:=]/i, /endpoint\s*[:=]\s*https?/i]) {
  assert.doesNotMatch(controlText, prohibited);
}

for (const source of [read("supabase/functions/chat-message/index.ts"), read("apps/mobile/src/services/chat.ts")]) {
  assert.doesNotMatch(source, /lumis-ai-chat-stg|LUMIS_AI_ENABLED|openai\.azure|azure\.com/i);
}

console.log("S2-T207 Microsoft/Azure readiness and privacy checks passed");
