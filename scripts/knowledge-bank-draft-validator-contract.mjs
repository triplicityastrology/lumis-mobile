import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "packages/astrology/src/knowledge-bank-draft-validator.ts",
  "utf8"
);
const doc = readFileSync(
  "docs/architecture/S2-T25-knowledge-bank-draft-structural-validator.md",
  "utf8"
);

assert.match(doc, /Status: development-only, inactive structural boundary/);
assert.match(
  doc,
  /canonical working technical base for this first development\s+draft/
);
assert.match(source, /knowledge_bank_draft_record_v0_2/);
assert.match(source, /knowledge_bank_draft_manifest_v0_2/);
for (const tag of ["natal_core", "natal_deep", "timing_future"]) {
  assert.match(source, new RegExp(`"${tag}"`));
}
for (const code of [
  "KB_DRAFT_DUPLICATE_RECORD_ID",
  "KB_DRAFT_SCOPE_TAG_INVALID",
  "KB_DRAFT_LANGUAGE_INVALID",
  "KB_DRAFT_PROHIBITED_SCOPE",
]) {
  assert.match(source, new RegExp(code));
}
assert.match(doc, /does not[\s\S]*evaluate astrology meanings/i);
assert.match(doc, /Authored interpretation fields are deliberately omitted/);
assert.match(doc, /Tests use synthetic records only/);
assert.doesNotMatch(
  source,
  /fetch\(|supabase|openai|anthropic|process\.env|apiKey|secret|dice\/|react-native/i
);

console.log("inactive Knowledge Bank draft validator contract passed");
