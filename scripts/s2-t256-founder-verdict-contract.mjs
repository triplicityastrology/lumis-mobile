import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const canonical = (value) => Array.isArray(value)
  ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object"
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
    : JSON.stringify(value);
const ratingKeys = ["correctness", "usefulness", "tone", "astrological_sense", "translation_quality", "vagueness", "repetition", "overconfidence", "safety"];
const payload = {
  schema_version: "s2_t261_founder_verdict_v2",
  review_contract_version: "s2_t261_founder_ai_review_v2",
  build_sha: "a".repeat(40),
  generated_from: "local_founder_console",
  entries: [{ fixture_id: "DICE-FOUNDER-EN-01", ratings: Object.fromEntries(ratingKeys.map((key) => [key, 3])), verdict: "pending" }],
};
const first = createHash("sha256").update(canonical(payload)).digest("hex");
const second = createHash("sha256").update(canonical(JSON.parse(canonical(payload)))).digest("hex");
assert.equal(first, second);
assert.match(first, /^[0-9a-f]{64}$/);
const schema = JSON.parse(readFileSync("supabase/tests/s2-t256-founder-verdict.schema.json", "utf8"));
assert.equal(schema.properties.payload.additionalProperties, false);
assert.equal(schema.properties.payload.properties.entries.maxItems, 44);
assert.deepEqual(schema.properties.payload.properties.entries.items.properties.verdict.enum, ["pending", "accepted", "returned"]);
console.log(`S2-T261 deterministic Founder verdict checksum passed ${first.slice(0, 12)}`);
