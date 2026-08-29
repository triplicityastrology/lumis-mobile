/** v5 Routing fixtures — Stage-1 schema, mode↔matched_rule pairing, route-review. */
import { parseDiceV05Stage1, matchedRuleOf, stage2ModeOf, diceV05Stage1Schema } from "./dice-v0-5-interpretation-contract.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }
function eq(a: unknown, b: unknown, l: string) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`FAIL ${l}\n got ${x}\n exp ${y}`); }

// Every mode pairs with exactly its matched_rule.
const rows: Array<[string, string, string]> = [
  ["timing", "STEP_1_TIMING", "timing"],
  ["location", "STEP_2_LOCATION", "location"],
  ["judgment", "STEP_3_JUDGMENT", "judgment"],
  ["person", "STEP_4_LEVEL1", "level1"],
  ["reason", "STEP_4_LEVEL1", "level1"],
  ["thing_or_situation", "STEP_4_LEVEL1", "level1"],
];
for (const [mode, rule, s2] of rows) {
  const r = parseDiceV05Stage1(JSON.stringify({ mode, matched_rule: rule }));
  ok(r && r.kind === "mode" && r.mode === mode && r.matched_rule === rule, `pairing ${mode}`);
  eq(matchedRuleOf(mode as any), rule, `matchedRuleOf ${mode}`);
  eq(stage2ModeOf(mode as any), s2, `stage2ModeOf ${mode}`);
}

// Route-review accepted only with ROUTE_REVIEW.
const rr = parseDiceV05Stage1(JSON.stringify({ mode: "route_review_required", matched_rule: "ROUTE_REVIEW" }));
ok(rr && rr.kind === "route_review", "route_review accepted");

// Mismatched pairings rejected (DICE_MODE_RULE_MISMATCH).
ok(parseDiceV05Stage1(JSON.stringify({ mode: "timing", matched_rule: "STEP_2_LOCATION" })) === null, "timing+location rule rejected");
ok(parseDiceV05Stage1(JSON.stringify({ mode: "person", matched_rule: "STEP_3_JUDGMENT" })) === null, "person+judgment rule rejected");
ok(parseDiceV05Stage1(JSON.stringify({ mode: "route_review_required", matched_rule: "STEP_1_TIMING" })) === null, "route_review+timing rule rejected");
// Unknown enum values, extra/missing keys.
ok(parseDiceV05Stage1(JSON.stringify({ mode: "who", matched_rule: "STEP_4_LEVEL1" })) === null, "unknown mode rejected");
ok(parseDiceV05Stage1(JSON.stringify({ mode: "timing", matched_rule: "STEP_1_TIMING", extra: 1 })) === null, "extra key rejected");
ok(parseDiceV05Stage1(JSON.stringify({ mode: "timing" })) === null, "missing key rejected");
ok(parseDiceV05Stage1("not json") === null, "non-json rejected");

// Schema shape: closed object, both keys required, correct enums.
const sc: any = diceV05Stage1Schema();
eq(sc.additionalProperties, false, "stage1 schema closed");
eq(sc.required, ["mode", "matched_rule"], "stage1 schema required");
ok(sc.properties.mode.enum.includes("route_review_required") && sc.properties.matched_rule.enum.includes("ROUTE_REVIEW"), "stage1 schema enums");

console.log("dice-v0-5 routing fixtures passed");
