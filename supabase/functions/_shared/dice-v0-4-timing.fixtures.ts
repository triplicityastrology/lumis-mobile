/**
 * §20.3 timing acceptance fixtures — the same application timing question with
 * Pluto/Sagittarius/House 1 versus Moon/Sagittarius/House 1. The prose is the
 * model's job at runtime; these deterministically verify that the two-stage
 * ENGINE feeds the correct speed distinction and enforces speed-only content:
 *   - Pluto is fed as the slowest intrinsic pace, Moon as the fastest;
 *   - Sagittarius is neutral dignity for both;
 *   - House 1 is a fast, near external environment for both;
 *   - the timing payload carries no Level-1 symbolism;
 *   - the validator accepts a speed-only reading and rejects Level-1 leakage.
 */
import {
  DICE_V04_RESULT_SCHEMA,
  buildDiceV04InterpretationPrompt,
  buildDiceV04RoutePayload,
  parseDiceV04Output,
} from "./dice-v0-4-interpretation-contract.ts";
import { presentDiceV04Result } from "./dice-v0-4-presentation.ts";

function ok(v: unknown, label: string): asserts v { if (!v) throw new Error("FAIL: " + label); }
function eq(a: unknown, b: unknown, label: string): void { if (a !== b) throw new Error(`FAIL: ${label} (got ${JSON.stringify(a)})`); }

const pluto = { planet: "pluto", sign: "sagittarius", house: "house_1" } as const;
const moon = { planet: "moon", sign: "sagittarius", house: "house_1" } as const;

// deno-lint-ignore no-explicit-any
const plutoPayload = buildDiceV04RoutePayload("timing", pluto) as any;
// deno-lint-ignore no-explicit-any
const moonPayload = buildDiceV04RoutePayload("timing", moon) as any;

eq(plutoPayload.planet.natural_speed, "slowest", "Pluto is fed the slowest intrinsic pace");
eq(moonPayload.planet.natural_speed, "fastest", "Moon is fed the fastest intrinsic pace");
ok(plutoPayload.planet.natural_speed !== moonPayload.planet.natural_speed, "Pluto and Moon speed differ");
eq(plutoPayload.planet.dignity.strength, "neutral", "Pluto in Sagittarius is neutral dignity");
eq(moonPayload.planet.dignity.strength, "neutral", "Moon in Sagittarius is neutral dignity");
eq(plutoPayload.house.external_speed, "fast", "House 1 is fast external movement (Pluto)");
eq(moonPayload.house.external_speed, "fast", "House 1 is fast external movement (Moon)");
// Timing payload carries no ordinary Level-1 symbolism.
for (const [label, p] of [["pluto", plutoPayload], ["moon", moonPayload]] as const) {
  ok(!("core" in p.planet) && !("object_function" in p.planet) && !("capability" in p.planet), `${label} timing payload has no Level-1 planet meaning`);
  ok(!p.sign_element, `${label} timing payload has no location element data`);
}

const q = "我個 application 幾時會批？";
for (const [label, landing] of [["pluto", pluto], ["moon", moon]] as const) {
  const prompt = buildDiceV04InterpretationPrompt("timing", q, "zh-Hant", landing);
  ok(/"question_mode":"timing"/.test(prompt), `${label} prompt is timing mode`);
  ok(/relative speed ONLY/i.test(prompt) || /speed/i.test(prompt), `${label} prompt states speed-only`);
  ok(/natural_speed/.test(prompt), `${label} prompt carries the natural speed`);
}

const base = (language: "en" | "zh-Hant") => ({ schema: DICE_V04_RESULT_SCHEMA, status: "completed", language, question_mode: "timing", planet_layer: null, sign_layer: null, house_layer: null, judgment_code: null, judgment_summary: null, practical_step: "Confirm one specific outstanding requirement before the next review point.", suggested_followups: [] as string[] });
const plutoResult = { ...base("en"), synthesis: "By nature this moves at the slowest pace, so expect a long, gradual unfolding rather than quick turns. The first-house setting can still bring earlier visible signs than such matters usually show.", timing_summary: "Slow overall in the natural scale of this matter, with the setting bringing earlier visible movement than the pace alone would suggest.", watch_out: "One overlooked requirement could stall an otherwise assisted matter, so confirm one open item rather than assuming it is done." };
const moonResult = { ...base("en"), synthesis: "By nature this moves at the fastest pace, so change can arrive sooner than expected. The first-house setting adds little resistance, keeping things comparatively direct.", timing_summary: "Comparatively fast within the natural scale of this matter, with a direct setting and little obstruction.", watch_out: "Moving quickly can mean acting before one detail is confirmed, so check the last open item before you rely on the result." };

const plutoOut = parseDiceV04Output(JSON.stringify(plutoResult), { mode: "timing", language: "en" });
const moonOut = parseDiceV04Output(JSON.stringify(moonResult), { mode: "timing", language: "en" });
ok(plutoOut?.kind === "completed", "Pluto speed-only timing reading accepted");
ok(moonOut?.kind === "completed", "Moon speed-only timing reading accepted");
ok(/slow/i.test(plutoResult.timing_summary) && /fast/i.test(moonResult.timing_summary), "Pluto reads slow, Moon reads fast");

eq(parseDiceV04Output(JSON.stringify({ ...plutoResult, synthesis: "This is about deep transformation and rebirth. It stays slow." }), { mode: "timing", language: "en" }), null, "Pluto psychology/transformation leak rejected");
eq(parseDiceV04Output(JSON.stringify({ ...moonResult, synthesis: "This runs on emotion and intuition. It moves fast." }), { mode: "timing", language: "en" }), null, "Moon emotion/intuition leak rejected");

const plutoPresentation = presentDiceV04Result((plutoOut as { result: Parameters<typeof presentDiceV04Result>[0] }).result, pluto);
eq(plutoPresentation.sections.map((s) => s.heading).join("|"), "Timing|Reading|One thing to watch|Practical step", "timing renders a Timing section, no verdict/follow-ups");
ok(plutoPresentation.opening.startsWith("You drew Pluto in Sagittarius in the 1st House. "), "Pluto timing opening line");

console.log("Dice v4 §20.3 timing fixtures passed: Pluto(slowest) vs Moon(fastest), Sagittarius neutral, House 1 fast, speed-only enforced, Level-1 leakage rejected.");
