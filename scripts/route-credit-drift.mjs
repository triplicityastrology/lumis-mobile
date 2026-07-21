import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routes = readFileSync("packages/shared/src/config/routes.ts", "utf8");
const chatEdge = readFileSync("supabase/functions/chat-message/index.ts", "utf8");
const approved = {
  casual: 1,
  knowledge: 3,
  dice: 5,
  astro_timing: 5,
  astro_deep: 5,
  out_of_scope: 1,
  safety: 1
};

const parsed = Object.fromEntries(
  [...routes.matchAll(/route:\s*"([a-z_]+)"[^\n]*credits:\s*(\d+)/g)].map((match) => [
    match[1],
    Number(match[2])
  ])
);

assert.deepEqual(parsed, approved, "Shared route credits drifted from the PM-approved 1/3/5/5/5/1/1 table.");
assert.match(chatEdge, /ROUTE_CREDITS as SHARED_ROUTE_CREDITS/);
assert.doesNotMatch(chatEdge, /casual:\s*1[\s\S]*knowledge:\s*3/);

console.log("route-credit drift checks passed");
