import assert from "node:assert/strict";
import { calculatePersonaProfile, offsetSign } from "./persona-calculator";

assert.equal(offsetSign(12, 2), 2);
assert.equal(offsetSign(8, 6), 2);
assert.equal(offsetSign(0, 2), null);

assert.deepEqual(calculatePersonaProfile({ roleCode: "saturnian_anchor", sunSign: 1, moonSign: 8, mercurySign: 1 }), {
  ok: true, ruleVersion: "v1", roleCode: "saturnian_anchor",
  calculatedProfile: [
    { factor: "ASC", signNumber: 10, sign: "Capricorn", source: "fixed_role", offset: 0 },
    { factor: "Sun", signNumber: 3, sign: "Gemini", source: "customer_sun", offset: 2 },
    { factor: "Saturn", signNumber: 10, sign: "Capricorn", source: "customer_moon", offset: 2 },
    { factor: "Mercury", signNumber: 7, sign: "Libra", source: "customer_mercury", offset: 6 }
  ], fallbacksApplied: []
});

assert.deepEqual(calculatePersonaProfile({ roleCode: "empathetic_peer", moonSign: 4, mercurySign: 6 }), {
  ok: true, ruleVersion: "v1", roleCode: "empathetic_peer",
  calculatedProfile: [
    { factor: "ASC", signNumber: 4, sign: "Cancer", source: "fixed_role", offset: 0 },
    { factor: "Moon", signNumber: 4, sign: "Cancer", source: "customer_moon", offset: 0 },
    { factor: "Mercury", signNumber: 10, sign: "Capricorn", source: "customer_mercury", offset: 4 }
  ], fallbacksApplied: []
});

assert.deepEqual(calculatePersonaProfile({ roleCode: "harmonious_catalyst", sunSign: 2, mercurySign: 8 }), {
  ok: true, ruleVersion: "v1", roleCode: "harmonious_catalyst",
  calculatedProfile: [
    { factor: "ASC", signNumber: 3, sign: "Gemini", source: "fixed_role", offset: 0 },
    { factor: "Sun", signNumber: 4, sign: "Cancer", source: "customer_sun", offset: 2 },
    { factor: "Mercury", signNumber: 10, sign: "Capricorn", source: "customer_mercury", offset: 2 }
  ], fallbacksApplied: []
});

const missingMoon = calculatePersonaProfile({ roleCode: "saturnian_anchor", sunSign: 5, moonSign: null, mercurySign: 12 });
assert.equal(missingMoon.ok, true);
if (missingMoon.ok) {
  // Worked Example 4 prints Gemini (3), but the v1 formula and both offset tables require 12 + 6 = 6 (Virgo).
  assert.deepEqual(missingMoon.calculatedProfile.map(({ factor, signNumber }) => [factor, signNumber]), [
    ["ASC", 10], ["Sun", 7], ["Mercury", 6]
  ]);
  assert.deepEqual(missingMoon.fallbacksApplied, ["stable_boundary"]);
}

assert.deepEqual(calculatePersonaProfile({ roleCode: "empathetic_peer", moonSign: null, mercurySign: 6 }), {
  ok: true, ruleVersion: "v1", roleCode: "empathetic_peer",
  calculatedProfile: [
    { factor: "ASC", signNumber: 4, sign: "Cancer", source: "fixed_role", offset: 0 },
    { factor: "Mercury", signNumber: 10, sign: "Capricorn", source: "customer_mercury", offset: 4 }
  ], fallbacksApplied: ["neutral_emotional_attunement"]
});

assert.deepEqual(calculatePersonaProfile({ roleCode: "harmonious_catalyst", mercurySign: 8 }), { ok: false, code: "PERSONA_SUN_REQUIRED" });
assert.deepEqual(calculatePersonaProfile({ roleCode: "empathetic_peer", moonSign: 4 }), { ok: false, code: "PERSONA_MERCURY_REQUIRED" });
assert.deepEqual(calculatePersonaProfile({ roleCode: "empathetic_peer", moonSign: 13, mercurySign: 6 }), { ok: false, code: "PERSONA_INPUT_INVALID" });

process.stdout.write("deterministic persona calculator fixtures passed\n");
