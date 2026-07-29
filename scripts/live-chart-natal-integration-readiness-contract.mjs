import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const audit = readFileSync(
  "docs/architecture/S2-T20-live-chart-lifecycle-integration-readiness-audit.md",
  "utf8"
);

assert.match(audit, /Status: inactive documentation\/readiness audit/);
assert.match(
  audit,
  /provider_neutral_natal_v1[\s\S]*natal_engine_input_v1[\s\S]*natal_engine_output_v1[\s\S]*natal_context_v1/
);
for (const boundary of [
  "Chart generation and provider normalisation",
  "Persistence",
  "Restoration",
  "Chat and Edge boundary",
  "trusted chart-to-adapter mapper",
  "pre-persistence deterministic validation",
  "separately authorised persistence envelope",
  "restoration verification",
  "server-owned Chat context",
]) {
  assert.match(audit, new RegExp(boundary, "i"));
}
for (const gate of [
  "approved absolute house-cusp source",
  "points missing absolute longitude",
  "Moon local-day endpoint source",
  "single angle authority",
  "bounded calculation provenance",
  "persistence/RLS/deletion design",
]) {
  assert.match(audit, new RegExp(gate, "i"));
}
for (let index = 1; index <= 14; index += 1) {
  assert.match(audit, new RegExp(`\\\`T20-${String(index).padStart(2, "0")}\\\``));
}
assert.match(audit, /Dice is fully excluded/);
assert.match(audit, /Not ready to integrate/);
assert.match(audit, /makes no production-code change/);
assert.match(audit, /authorises no provider call/);
assert.doesNotMatch(audit, /https?:\/\//);
assert.doesNotMatch(audit, /sb_secret_|service_role\s*[:=]|password\s*[:=]/i);

console.log("inactive live chart natal integration readiness audit passed");
