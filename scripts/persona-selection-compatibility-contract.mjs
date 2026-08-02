import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const matrix = JSON.parse(fs.readFileSync(path.join(root, "supabase/tests/s2-t159-persona-selection-compatibility.json"), "utf8"));
const stableCodes = ["empathetic_peer", "harmonious_catalyst", "saturnian_anchor"];
const legacyKeys = ["acceptance", "spark", "awareness"];

assert.deepEqual(Object.keys(matrix), [
  "schema", "status", "mapping", "legacy_label_persistence_files", "legacy_label_interface_files",
  "display_only_files", "stable_role_code_files", "unknown_boundaries", "new_write_rule"
], "compatibility matrix schema must remain closed");
assert.equal(matrix.schema, "s2_t159_persona_selection_compatibility_v1");
assert.equal(matrix.status, "audit_only_inactive");
assert.deepEqual(Object.keys(matrix.mapping), legacyKeys);
assert.deepEqual(Object.values(matrix.mapping), stableCodes);
assert.deepEqual(matrix.unknown_boundaries, [], "unknown Persona boundaries require an explicit audit decision");
assert.deepEqual(matrix.new_write_rule, {
  canonical_field: "persona_role_code",
  label_only_persistence_allowed: false,
  historical_rewrite_required: false,
  migration_required_now: false
});

for (const category of ["legacy_label_persistence_files", "legacy_label_interface_files", "display_only_files", "stable_role_code_files"]) {
  assert.ok(matrix[category].length > 0, `${category} must not be empty`);
  for (const relativePath of matrix[category]) {
    assert.ok(fs.existsSync(path.join(root, relativePath)), `${category} path must exist: ${relativePath}`);
  }
}

const migrationDir = path.join(root, "supabase/migrations");
const personaMigrations = fs.readdirSync(migrationDir)
  .filter((name) => name.endsWith(".sql"))
  .filter((name) => fs.readFileSync(path.join(migrationDir, name), "utf8").includes("persona_style"))
  .map((name) => `supabase/migrations/${name}`)
  .sort();
assert.deepEqual(personaMigrations, [...matrix.legacy_label_persistence_files].sort(),
  "new persona_style persistence requires compatibility review and a canonical role code");

for (const relativePath of matrix.stable_role_code_files) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  for (const code of stableCodes) assert.match(source, new RegExp(`\\b${code}\\b`));
}

const calculator = fs.readFileSync(path.join(root, "packages/shared/src/config/persona-calculator.ts"), "utf8");
assert.match(calculator, /"Ordinary Person":\s*"empathetic_peer"/);
assert.match(calculator, /Friend:\s*"harmonious_catalyst"/);
assert.match(calculator, /Mentor:\s*"saturnian_anchor"/);
assert.match(calculator, /Acceptance:\s*"empathetic_peer"/);
assert.match(calculator, /Spark:\s*"harmonious_catalyst"/);
assert.match(calculator, /Awareness:\s*"saturnian_anchor"/);

function validateNewBoundary(relativePath, source) {
  const personaBearing = /persona_(?:style|selection|role)|\bPersona\b/i.test(source);
  if (!personaBearing) return { ok: true };
  const eventOrPersistence = /migration|analytics|event|persist|insert|update/i.test(`${relativePath}\n${source}`);
  if (!eventOrPersistence) return { ok: true };
  const canonical = /persona_role_code/.test(source) && stableCodes.every((code) => source.includes(code));
  return canonical ? { ok: true } : { ok: false, code: "PERSONA_CANONICAL_ROLE_REQUIRED" };
}

assert.deepEqual(validateNewBoundary("supabase/migrations/9999_new_persona_event.sql", "insert persona_style into persona_events"),
  { ok: false, code: "PERSONA_CANONICAL_ROLE_REQUIRED" });
assert.deepEqual(validateNewBoundary("apps/mobile/src/analytics/persona.ts", "track({ persona_style: selection })"),
  { ok: false, code: "PERSONA_CANONICAL_ROLE_REQUIRED" });
assert.deepEqual(validateNewBoundary("supabase/migrations/9999_new_persona_event.sql",
  "persona_role_code check (persona_role_code in ('empathetic_peer','harmonious_catalyst','saturnian_anchor'))"), { ok: true });
assert.deepEqual(validateNewBoundary("apps/mobile/src/screens/Persona.tsx", "render Persona display name"), { ok: true });

const audit = fs.readFileSync(path.join(root, "docs/architecture/S2-T159-persona-selection-compatibility-audit.md"), "utf8");
assert.match(audit, /No migration is required now\./);
assert.match(audit, /Historical rows, fixtures, and evidence are not rewritten/);
assert.match(audit, /No active general analytics SDK or Persona analytics pipeline was found/);
assert.match(audit, /Ordinary Person \| Acceptance \| `acceptance` \| `empathetic_peer`/);
assert.match(audit, /Friend \| Spark \| `spark` \| `harmonious_catalyst`/);
assert.match(audit, /Mentor \| Awareness \| `awareness` \| `saturnian_anchor`/);

console.log("S2-T159 persona selection compatibility contract passed.");
