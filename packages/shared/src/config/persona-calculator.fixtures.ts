import assert from "node:assert/strict";
import { calculatePersonaProfile, offsetSign } from "./persona-calculator";

assert.equal(offsetSign(12, 6), 6, "Pisces plus six is Virgo");
assert.equal(offsetSign(8, 6), 2);
assert.equal(offsetSign(0, 2), null);

const confirmedMoon = { status: "available", proof: "confirmed_birth_time", sign: 8 } as const;
const endpointMoon = { status: "available", proof: "local_day_single_sign", sign: 4, localDayStartSign: 4, localDayEndSign: 4 } as const;
const unconfirmedMoon = { status: "unconfirmed" } as const;

for (const [currentLabel, stableRoleCode] of [
  ["Ordinary Person", "empathetic_peer"],
  ["Friend", "harmonious_catalyst"],
  ["Mentor", "saturnian_anchor"],
] as const) {
  const result = calculatePersonaProfile({ roleCode: currentLabel, sunSign: 2, moon: confirmedMoon, mercurySign: 12 });
  assert.equal(result.ok, true, `${currentLabel} resolves`);
  if (result.ok) assert.equal(result.roleCode, stableRoleCode, `${currentLabel} uses stable role code`);
}

for (const [historicalLabel, stableRoleCode] of [
  ["Acceptance", "empathetic_peer"],
  ["Spark", "harmonious_catalyst"],
  ["Awareness", "saturnian_anchor"],
] as const) {
  const result = calculatePersonaProfile({ roleCode: historicalLabel, sunSign: 2, moon: confirmedMoon, mercurySign: 12 });
  assert.equal(result.ok, true, `${historicalLabel} remains compatible`);
  if (result.ok) assert.equal(result.roleCode, stableRoleCode, `${historicalLabel} historical evidence remains stable`);
}

const awareness = calculatePersonaProfile({ roleCode: "Awareness", sunSign: 1, moon: confirmedMoon, mercurySign: 12 });
assert.equal(awareness.ok, true);
if (awareness.ok) {
  assert.equal(awareness.roleCode, "saturnian_anchor", "legacy label resolves to stable role code");
  assert.deepEqual(awareness.calculatedProfile.map(({ factor, sign, source }) => [factor, sign, source]), [
    ["ASC", "Capricorn", "fixed_role"],
    ["Sun", "Gemini", "customer_sun"],
    ["Saturn", "Capricorn", "customer_moon"],
    ["Mercury", "Virgo", "customer_mercury"],
  ]);
}

const acceptanceEndpoint = calculatePersonaProfile({ roleCode: "empathetic_peer", sunSign: 2, moon: endpointMoon, mercurySign: 6 });
assert.equal(acceptanceEndpoint.ok, true);
if (acceptanceEndpoint.ok) {
  assert.equal(acceptanceEndpoint.provenance.customerMoonProof, "local_day_single_sign");
  assert.deepEqual(acceptanceEndpoint.sourceRulesApplied, []);
}

for (const [roleCode, expectedFactor, expectedSign, expectedRule] of [
  ["empathetic_peer", "Moon", "Leo", "acceptance_moon_from_customer_sun"],
  ["harmonious_catalyst", "Moon", "Sagittarius", "spark_moon_from_customer_sun_trine"],
  ["saturnian_anchor", "Saturn", "Libra", "awareness_saturn_from_customer_sun_sextile"],
] as const) {
  const result = calculatePersonaProfile({ roleCode, sunSign: 5, moon: unconfirmedMoon, mercurySign: 12 });
  assert.equal(result.ok, true, roleCode);
  if (result.ok) {
    const derived = result.calculatedProfile.find(({ factor }) => factor === expectedFactor);
    assert.equal(derived?.sign, expectedSign, roleCode);
    assert.equal(derived?.source, "customer_sun", roleCode);
    assert.equal(derived?.sourceRuleCode, expectedRule, roleCode);
    assert.deepEqual(result.sourceRulesApplied, [expectedRule], roleCode);
  }
}

const sparkAvailable = calculatePersonaProfile({ roleCode: "Spark", sunSign: 2, moon: confirmedMoon, mercurySign: 8 });
assert.equal(sparkAvailable.ok, true);
if (sparkAvailable.ok) assert.deepEqual(sparkAvailable.calculatedProfile.map(({ factor }) => factor), ["ASC", "Sun", "Moon", "Mercury"]);

const unavailable = { ok: false, code: "customer_chart_unavailable", action: "stop_persona_generation_and_retry" } as const;
assert.deepEqual(calculatePersonaProfile({ roleCode: "Acceptance", sunSign: 2, moon: confirmedMoon, mercurySign: null }), unavailable);
assert.deepEqual(calculatePersonaProfile({ roleCode: "Spark", sunSign: null, moon: unconfirmedMoon, mercurySign: 8 }), unavailable);
assert.deepEqual(calculatePersonaProfile({ roleCode: "Awareness", sunSign: 2, moon: { status: "available", proof: "local_day_single_sign", sign: 4, localDayStartSign: 4, localDayEndSign: 5 }, mercurySign: 8 }), unavailable);
assert.deepEqual(calculatePersonaProfile({ roleCode: "Acceptance", sunSign: 2, moon: { status: "available", proof: "noon", sign: 4 }, mercurySign: 8 }), unavailable);
assert.deepEqual(calculatePersonaProfile({ roleCode: "unknown", sunSign: 2, moon: unconfirmedMoon, mercurySign: 8 }), { ok: false, code: "PERSONA_INPUT_INVALID" });
assert.deepEqual(calculatePersonaProfile({ roleCode: "Acceptance", sunSign: 2, moon: unconfirmedMoon, mercurySign: 8, extra: true }), { ok: false, code: "PERSONA_INPUT_INVALID" });

process.stdout.write("final deterministic persona decision fixtures passed\n");
