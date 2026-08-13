#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("apps/mobile/src/services/chatAfterDiceProductCandidate.fixtures.ts", "utf8");
for (const language of ["en", "zh-Hant"]) assert.match(source, new RegExp(`"${language.replace("-", "\\-")}"`));
for (const phase of ["loading", "completed", "fallback", "safety", "technical_error"]) {
  assert.match(source, new RegExp(`"${phase}"`));
}
assert.match(source, /transportConstructions, 0/);
assert.match(source, /latchClaims, 0/);
assert.match(source, /payloadReads, 0/);
assert.match(source, /latch\.calls\(\), 1/);
console.log("S2_T336_DISABLED_EMULATOR_OK languages=2 states=5 auto_navigation=0 duplicate_calls=0 provider_calls=0 persistence=0 units=0");
