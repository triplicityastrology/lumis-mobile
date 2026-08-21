// Basic natal Knowledge Bank tests (planet-in-sign grounding from the controlled bank).
// Run: tsc -p internal/companion-web-ai-lab/tsconfig.json && node <emitted>/test/lab-knowledge-bank.fixtures.js
//
// Proves: retrieval uses the person's OWN signs; unconfirmed Moon is suppressed (never inferred);
// facts are capped at the six-fact budget; grounding is composed planet=what/sign=how with the
// Answer-Rule guardrails; and only controlled-bank signs are produced (no invention).

import test from "node:test";
import { strict as assert } from "node:assert";
import { retrieveNatalFacts, buildKnowledgeGrounding } from "../src/lab-knowledge-bank.ts";

const chart = (over: Partial<{ sun: number; moon: number; mercury: number; saturn: number; moon_confirmed: boolean }> = {}) =>
  ({ sun: 3, moon: 6, mercury: 3, saturn: 10, moon_confirmed: true, ...over });

test("retrieves Sun/Moon/Mercury/Saturn planet-in-sign facts for the person's own chart", () => {
  const r = retrieveNatalFacts(chart());
  const key = r.facts.map((f) => `${f.planet}:${f.sign_name}`);
  assert.deepEqual(key, ["sun:Gemini", "moon:Virgo", "mercury:Gemini", "saturn:Capricorn"]);
  // planet=what, sign=how composition present.
  const sun = r.facts[0];
  assert.ok(sun.composed.includes("Sun in Gemini"));
  assert.ok(sun.what.includes("identity") && sun.how.includes("curiosity"));
});

test("unconfirmed Moon is SUPPRESSED, never inferred", () => {
  const r = retrieveNatalFacts(chart({ moon_confirmed: false }));
  assert.equal(r.facts.some((f) => f.planet === "moon"), false, "no Moon fact when unconfirmed");
  assert.equal(r.suppressed.some((s) => s.planet === "Moon"), true, "Moon recorded as suppressed");
  assert.deepEqual(r.facts.map((f) => f.planet), ["sun", "mercury", "saturn"]);
});

test("retrieval never exceeds the six-fact budget", () => {
  const r = retrieveNatalFacts(chart());
  assert.ok(r.facts.length <= 6);
});

test("grounding block composes facts + Answer-Rule guardrails; conditional; facts are planet-in-sign only", () => {
  const r = retrieveNatalFacts(chart());
  const g = buildKnowledgeGrounding(r)!;
  assert.ok(typeof g === "string" && g.length > 0);
  assert.ok(g.includes("Sun in Gemini") && g.includes("Saturn in Capricorn"));
  assert.ok(/may|can|tends to/i.test(g), "conditional-language guardrail present");
  assert.ok(/do not add astrology that is not here|use only the facts/i.test(g), "ANS-01 boundary present");
  // The FACTS themselves are planet-in-sign only (no house/angle/timing facts without a birth time).
  for (const f of r.facts) assert.equal(/\bhouse\b|\bascendant\b|\btransit\b|solar return/i.test(f.composed), false, `fact ${f.planet} is planet-in-sign only`);
});

test("every produced sign is a real controlled-bank sign (no invention)", () => {
  const bankSigns = new Set(["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]);
  for (let s = 1; s <= 12; s++) {
    const r = retrieveNatalFacts(chart({ sun: s, moon: s, mercury: s, saturn: s }));
    for (const f of r.facts) assert.equal(bankSigns.has(f.sign_name), true, `sign ${f.sign_name} is a bank sign`);
  }
});

test("non-generative callers pass no chart -> empty grounding is null", () => {
  assert.equal(buildKnowledgeGrounding({ facts: [], suppressed: [] }), null);
});
