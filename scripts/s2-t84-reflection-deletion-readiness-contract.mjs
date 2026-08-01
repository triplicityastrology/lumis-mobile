import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readiness = readFileSync("scripts/s2-t84-reflection-deletion-readiness.mjs", "utf8");
const runbook = readFileSync("docs/qa/S2-T84-past-reflections-deletion-readiness.md", "utf8");
const app = readFileSync("apps/mobile/App.tsx", "utf8");

assert.match(readiness, /bmqhwofmdgebpcihjlnb/);
assert.match(readiness, /createHash\("sha256"\)/);
assert.match(readiness, /execution_available=false/);
assert.doesNotMatch(readiness, /fetch\(|createClient|supabase db|functions deploy|password|secret|token/i);
assert.match(runbook, /0035[\s\S]*0036/);
assert.match(runbook, /blocked_pending_text_type_review/);
assert.match(runbook, /local-demo[\s\S]*immediately testable/i);
assert.match(runbook, /Cancel[\s\S]*Retry[\s\S]*success/i);
assert.doesNotMatch(runbook, /service_role|sb_secret_|access_token|--password/);
assert.match(app, /if \(!result\.ok\) return false;[\s\S]{0,220}applyConfirmedReflectionDeletion/);
assert.match(app, /setReflectionToDelete\(null\)/);

process.stdout.write("S2-T84 reflection deletion readiness contract passed\n");
