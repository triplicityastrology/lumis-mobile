/** v5 Privacy / accounting fixtures (§20.6) — metadata-only outcomes, provider-call
 * counts 0/1/2, units 0 / persistence 0, no raw question or response in any export. */
import {
  executeDiceV05FreeTextCase, parseDiceV05FreeTextRequest,
  type DiceV05ProviderAdapter, type DiceV05CaseOutcome,
} from "./dice-v0-5-window.ts";

function ok(c: unknown, l: string): asserts c { if (!c) throw new Error("FAIL " + l); }

function mock(responses: string[]): DiceV05ProviderAdapter {
  let i = 0;
  return { invoke: async () => { const c = responses[i++]; return c === undefined ? { kind: "network" as const } : { kind: "success" as const, content: c }; } };
}
const stage1 = (mode: string, rule: string) => JSON.stringify({ mode, matched_rule: rule });
const req = (question: string, planet = "jupiter", sign = "sagittarius", house = "house_1") => ({ question, planet_id: planet, sign_id: sign, house_id: house });

// Whitelisted metadata keys only — no free-text fields.
const META_KEYS = ["request_mode", "language", "question_mode", "result_class", "provider_calls", "latency_bucket", "cost_bucket", "units_consumed", "persistence_writes"].sort();

async function run(question: string, responses: string[], planet?: string, sign?: string, house?: string): Promise<DiceV05CaseOutcome> {
  const parsed = parseDiceV05FreeTextRequest(req(question, planet, sign, house));
  ok(parsed, "request parses: " + question);
  return executeDiceV05FreeTextCase(parsed!, mock(responses), () => 1000);
}

async function main() {
  // Completed judgment: 2 provider calls, metadata-only, units/persistence 0.
  const jgResp = JSON.stringify({ status: "ok", planet_prose: "Jupiter is a major benefic here, at full strength.",
    house_prose: "House 1 is great fortune and ranked first, a supportive environment.",
    synthesis: "Both sides are favourable and stay separate, not averaged into one grade.",
    watch_out: "Expansive optimism can overreach, so keep spending realistic.", suggested_followups: ["What should I prepare first?"] });
  const jg = await run("Should I take the new job offer?", [stage1("judgment", "STEP_3_JUDGMENT"), jgResp]);
  ok(jg.kind === "completed" && jg.question_mode === "judgment", "judgment completed");
  ok(jg.provider_calls === 2, "judgment 2 provider calls");
  ok(jg.metadata.units_consumed === 0 && jg.metadata.persistence_writes === 0, "units/persistence 0");
  eq_keys(jg.metadata, "judgment metadata keys");
  // The raw question and provider prose must NOT appear anywhere in the metadata.
  const metaStr = JSON.stringify(jg.metadata);
  ok(!metaStr.includes("new job offer"), "metadata omits raw question");
  ok(!metaStr.includes("major benefic") && !metaStr.includes("great fortune"), "metadata omits provider prose");

  // Hard-gate safety: 0 provider calls, metadata-only.
  const safety = await run("I want to kill myself", []);
  ok(safety.kind === "safety" && safety.provider_calls === 0, "safety hard gate, 0 calls");
  eq_keys(safety.metadata, "safety metadata keys");

  // Bundled hard gate: 0 provider calls.
  const bundled = await run("Should I take it; when will it start?", []);
  ok(bundled.kind === "bundled" && bundled.provider_calls === 0, "bundled hard gate, 0 calls");

  // Stage-1 route review: exactly 1 provider call.
  const rr = await run("Should I take the new job offer?", [stage1("route_review_required", "ROUTE_REVIEW")]);
  ok(rr.kind === "route_review" && rr.provider_calls === 1, "stage-1 route review, 1 call");

  // Provider network failure at Stage 1: fallback, 1 call, no leak.
  const netfail = await run("Should I take the new job offer?", []); // mock returns network
  ok(netfail.kind === "fallback" && netfail.code === "DICE_NETWORK" && netfail.provider_calls === 1, "stage-1 network fallback");

  console.log("dice-v0-5 privacy fixtures passed");
}

function eq_keys(meta: Record<string, unknown>, label: string) {
  const k = Object.keys(meta).sort();
  if (k.length !== META_KEYS.length || !k.every((x, i) => x === META_KEYS[i])) throw new Error(`FAIL ${label}: ${JSON.stringify(k)}`);
}

// A failing assertion rejects this promise → node reports it and exits non-zero.
void main();
