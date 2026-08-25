// Part 1 tests: the Character Voice Card is built deterministically from approved mapping rows and
// differentiates characters. Run: tsc && node <emitted>/test/lab-persona-voice.fixtures.js
//
// Proves: each resolved factor retrieves EXACTLY ONE approved mapping row (mapping_id = factor_sign,
// versioned); assembly is deterministic (same chart+role -> byte-identical card); different signs
// yield different cards; the three approved roles produce distinguishable characters for the SAME
// customer chart; Mercury is ordered last (it colours communication, it does not redefine the role);
// and the card is built only from behaviour mappings (no customer natal facts leak into the voice).

import test from "node:test";
import { strict as assert } from "node:assert";
import { validateLabRequest, deriveChartComposition } from "../src/lab-engine.ts";
import { buildVoiceCard, BEHAVIOUR_BANK, BEHAVIOUR_MAPPING_VERSION } from "../src/lab-persona-voice.ts";
import { LAB_ROLES } from "../src/lab-constants.ts";
import { assemblePersona } from "../src/lab-provider.ts";
import { COMPANION_IDENTITY_SCOPE, COMPANION_NATURAL_CONVERSATION, ROLE_CONTRACT_V3 } from "../../../supabase/functions/_shared/companion-synthesis-v1.ts";

// A single synthetic customer chart, reused across roles.
const CHART = { sun: 3, moon: 6, mercury: 7, saturn: 10, moon_confirmed: true };

function compositionFor(roleCode: string) {
  const v = validateLabRequest({
    schema_version: "companion_web_ai_lab_request_v1",
    role_code: roleCode, chart: CHART, message: "hello", app_language_preference: null, context: [],
  });
  if (!v.ok) throw new Error(`request invalid for ${roleCode}: ${v.error_code}`);
  return deriveChartComposition(v.request);
}

test("each resolved factor retrieves exactly one approved, versioned mapping row", () => {
  const comp = compositionFor("harmonious_catalyst"); // ASC+Sun+Moon+Mercury
  const role = LAB_ROLES.find((r) => r.code === "harmonious_catalyst")!;
  const card = buildVoiceCard(comp, role.currentLabel, role.code)!;
  assert.ok(card, "voice card built");
  assert.equal(BEHAVIOUR_MAPPING_VERSION, "v1.3", "approved workbook version (AP-5a content rewrite)");
  for (const row of card.rows) {
    assert.equal(row.mapping_id, `${row.factor.toLowerCase()}_${row.sign.toLowerCase()}`);
    assert.ok(BEHAVIOUR_BANK[row.mapping_id], "row comes from the approved bank");
    assert.equal(row.version, BEHAVIOUR_BANK[row.mapping_id].version, "row carries its own mapping version");
    assert.equal(row.included, true);
  }
  // Exactly one row per factor (no duplicates).
  const factors = card.rows.map((r) => r.factor);
  assert.equal(new Set(factors).size, factors.length, "no factor retrieved twice");
});

test("assembly is deterministic — same chart + role gives a byte-identical card", () => {
  const role = LAB_ROLES.find((r) => r.code === "saturnian_anchor")!;
  const a = buildVoiceCard(compositionFor("saturnian_anchor"), role.currentLabel, role.code)!;
  const b = buildVoiceCard(compositionFor("saturnian_anchor"), role.currentLabel, role.code)!;
  assert.equal(a.card_text, b.card_text);
  assert.deepEqual(a.rows.map((r) => r.mapping_id), b.rows.map((r) => r.mapping_id));
});

test("different signs produce different character voice", () => {
  const role = LAB_ROLES.find((r) => r.code === "empathetic_peer")!;
  const one = buildVoiceCard({ available: true, factors: [{ factor: "ASC", sign: "Cancer" }, { factor: "Moon", sign: "Virgo" }, { factor: "Mercury", sign: "Libra" }] }, role.currentLabel, role.code)!;
  const two = buildVoiceCard({ available: true, factors: [{ factor: "ASC", sign: "Aries" }, { factor: "Moon", sign: "Scorpio" }, { factor: "Mercury", sign: "Sagittarius" }] }, role.currentLabel, role.code)!;
  assert.notEqual(one.card_text, two.card_text);
});

test("the three approved roles produce distinguishable characters for the SAME customer chart", () => {
  const texts = new Map<string, string>();
  for (const code of ["empathetic_peer", "harmonious_catalyst", "saturnian_anchor"]) {
    const role = LAB_ROLES.find((r) => r.code === code)!;
    const card = buildVoiceCard(compositionFor(code), role.currentLabel, role.code)!;
    texts.set(code, card.card_text);
  }
  const distinct = new Set(texts.values());
  assert.equal(distinct.size, 3, "each role yields a distinct character voice for the same chart");
  // The catalyst and anchor differ from the peer by pulling different factors (Sun / Saturn).
  const catalystFactors = new Set(buildVoiceCard(compositionFor("harmonious_catalyst"), "Spark", "harmonious_catalyst")!.rows.map((r) => r.factor));
  const anchorFactors = new Set(buildVoiceCard(compositionFor("saturnian_anchor"), "Awareness", "saturnian_anchor")!.rows.map((r) => r.factor));
  assert.ok(catalystFactors.has("Sun"), "catalyst voice includes Sun");
  assert.ok(anchorFactors.has("Saturn"), "anchor voice includes Saturn");
});

test("Mercury is ordered LAST — it colours communication, it does not lead the character", () => {
  const role = LAB_ROLES.find((r) => r.code === "harmonious_catalyst")!;
  const card = buildVoiceCard(compositionFor("harmonious_catalyst"), role.currentLabel, role.code)!;
  const merc = card.rows.find((r) => r.factor === "Mercury")!;
  assert.equal(card.rows[card.rows.length - 1].factor, "Mercury", "Mercury is the last voice layer");
  assert.match(merc.layer, /communication/i);
});

test("Prompt v3: identity/scope + natural-conversation + chart-translation from shared source; placement-free summaries", () => {
  const role = LAB_ROLES.find((r) => r.code === "empathetic_peer")!;
  const chart = { sun: 3, moon: 6, mercury: 7, saturn: 10, moon_confirmed: true };
  const assembly = assemblePersona(
    { roleContract: { publicName: role.currentLabel, corePurpose: "p" }, situationParameters: { route: "ordinary" } },
    "hi", "en", [], compositionFor("empathetic_peer"), "Some member facts.", chart,
  );
  const byName = (n: string) => assembly.blocks.find((b) => b.name === n)!;
  // Canonical block text comes verbatim from the shared synthesis source (one source, no drift).
  assert.equal(byName("1. IDENTITY AND SCOPE").text, COMPANION_IDENTITY_SCOPE);
  assert.match(byName("1. IDENTITY AND SCOPE").text, /general-purpose how-to assistant/);
  assert.equal(byName("7. NATURAL CONVERSATION AND REPAIR").text, COMPANION_NATURAL_CONVERSATION);
  assert.match(byName("7. NATURAL CONVERSATION AND REPAIR").text, /Do not ask the member to choose between listening/);
  // Block 3 role purpose uses the approved v3 role contract text.
  assert.match(byName("3. ROLE PURPOSE").text, /emotional presence, acceptance, and companionship/);
  // Block 6 chart translation carries the need->factor logic + facts + astrology-visibility rules.
  const chartBlock = byName("6. CHART TRANSLATION AND ASTROLOGY VISIBILITY").text;
  assert.match(chartBlock, /Available approved member facts:/);
  assert.match(chartBlock, /consult Moon/);
  assert.match(chartBlock, /Keep astrology invisible by default/);
  // Block 4 Lumis Character Expression + block 5 Moon-led member profile present and PLACEMENT-FREE.
  assert.match(byName("4. LUMIS CHARACTER EXPRESSION").text, /^Lumis is a /);
  const profile = byName("5. MEMBER COMMUNICATION AND COMFORT PROFILE").text;
  assert.match(profile, /^This member /);
  assert.equal(/\b(Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)\b|Moon in|Sun in|Mercury in|Saturn in/.test(profile.split("\n\n")[0]), false, "member profile names no astrology placements");
});

test("an unavailable composition yields no voice card (no invented character)", () => {
  assert.equal(buildVoiceCard({ available: false, factors: [] }, "Acceptance", "empathetic_peer"), null);
  assert.equal(buildVoiceCard({ available: true, factors: [] }, "Acceptance", "empathetic_peer"), null);
});

test("assembled prompt uses the approved 10-block architecture; role block is PURPOSE only", () => {
  for (const code of ["empathetic_peer", "harmonious_catalyst", "saturnian_anchor"]) {
    const role = LAB_ROLES.find((candidate) => candidate.code === code)!;
    const composition = compositionFor(code);
    const corePurpose = `Synthetic purpose for ${role.code}.`;
    const chart = { sun: 1, moon: 8, mercury: 1, saturn: 10, moon_confirmed: true };
    const assembly = assemblePersona({
      roleContract: { publicName: role.currentLabel, corePurpose },
      situationParameters: { route: "ordinary" },
    }, "A synthetic conversation turn.", "en", [
      { role: "user", text: "An earlier synthetic turn." },
    ], composition, "Synthetic context only.", chart);

    assert.deepEqual(assembly.blocks.map((block) => block.name), [
      "1. IDENTITY AND SCOPE",
      "2. CURRENT SITUATION",
      "3. ROLE PURPOSE",
      "4. LUMIS CHARACTER EXPRESSION",
      "5. MEMBER COMMUNICATION AND COMFORT PROFILE",
      "6. CHART TRANSLATION AND ASTROLOGY VISIBILITY",
      "7. NATURAL CONVERSATION AND REPAIR",
      "8. CONTINUITY AND EXPRESSED PREFERENCES",
      "9. LANGUAGE AND FLEXIBLE LENGTH",
      "10. CURRENT USER MESSAGE",
    ]);
    assert.equal(assembly.blocks[0].text, COMPANION_IDENTITY_SCOPE);
    assert.equal(assembly.prompt.includes("You are Lumis, a companion"), true);
    // Block 3 uses the approved v3 role contract as a conversational perspective, not a format.
    assert.equal(assembly.blocks[2].text, `Role: ${role.currentLabel} (${role.code}).\n\n${ROLE_CONTRACT_V3[code]}\n\nThis role determines why you are responding. It is a conversational perspective, not a required format, opening, question, list, or catchphrase.`);
  }
});
