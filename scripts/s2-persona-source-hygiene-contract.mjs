import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const files = [
  "scripts/persona-prompt-pipeline-contract.mjs",
  "supabase/functions/_shared/persona-prompt-pipeline-v1.fixtures.ts",
  "supabase/functions/_shared/persona-prompt-pipeline-v1.ts",
  "supabase/functions/tsconfig.persona-behavior-test.json",
  "docs/qa/S2-T161-persona-label-only-legacy-staging-audit-readiness.md",
  "scripts/lib/persona-legacy-audit-evidence.mjs",
  "scripts/s2-persona-legacy-audit-contract.mjs",
  "scripts/s2-persona-legacy-audit-evidence.mjs",
  "supabase/dashboard-packets/s2-t161/persona_legacy_selection_read_only.sql",
  "supabase/tests/s2-t161-persona-legacy-audit.valid.json",
];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  assert.equal(source.endsWith("\n"), true, `${file} must end with one newline`);
  assert.equal(source.endsWith("\n\n"), false, `${file} must not end with a blank line`);
  assert.doesNotMatch(source, /[\t ]+$/mu, `${file} must not contain trailing whitespace`);
}

console.log("S2-T160/T161 source hygiene contract passed.");
