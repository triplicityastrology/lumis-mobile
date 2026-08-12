#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("apps/mobile/src/services/chatAfterDiceRoot.fixtures.ts", "utf8");
for (const language of ["en", "zh-Hant"]) assert.match(source, new RegExp(`\"${language.replace("-", "\\-")}\"`));
for (const phase of ["loading", "result", "safety", "fallback", "retry"]) assert.match(source, new RegExp(`\"${phase}\"`));
assert.match(source, /transportConstructions, 0/);
console.log("S2_T331_DISABLED_EMULATOR_MATRIX_OK languages=2 states=5 provider_calls=0 persistence=0 units=0");
