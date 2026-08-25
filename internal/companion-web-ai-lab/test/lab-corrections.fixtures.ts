// Founder correction round tests (2026-08-25): every role factor contributes to the Lumis Character
// Summary exactly once (#1); duplicate factor flavours are reinforced, not repeated verbatim (#3);
// failed turns are excluded from rolling model history (#6); full +arch_v3 version is recorded (#7).

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.LAB_SESSIONS_DIR = mkdtempSync(join(tmpdir(), "lab-corrections-"));

import test from "node:test";
import { strict as assert } from "node:assert";
import { buildLumisCharacterSummary } from "../../../supabase/functions/_shared/companion-synthesis-v1.ts";
import { buildVoiceCard, BEHAVIOUR_BANK } from "../src/lab-persona-voice.ts";
import { validateLabRequest, deriveChartComposition } from "../src/lab-engine.ts";
import { contextEligibleTurn } from "../src/lab-turn.ts";
import { LAB_PROMPT_VERSION } from "../src/lab-identity.ts";
import { handleSessionNew } from "../src/lab-session-api.ts";
import { LAB_ROLES } from "../src/lab-constants.ts";

const ROLE_FACTORS: Record<string, string[]> = {
  empathetic_peer: ["ASC", "Moon", "Mercury"],
  harmonious_catalyst: ["ASC", "Sun", "Moon", "Mercury"],
  saturnian_anchor: ["ASC", "Sun", "Saturn", "Mercury"],
};

function summaryFor(roleCode: string, chart: { sun: number; moon: number; mercury: number; saturn: number; moon_confirmed: boolean }) {
  const v = validateLabRequest({ schema_version: "companion_web_ai_lab_request_v1", role_code: roleCode, chart, message: "hi", app_language_preference: null, context: [] });
  if (!v.ok) throw new Error("invalid " + roleCode);
  const comp = deriveChartComposition(v.request);
  const role = LAB_ROLES.find((r) => r.code === roleCode)!;
  const card = buildVoiceCard(comp, role.currentLabel, role.code)!;
  const flav = (f: string) => { const r = card.rows.find((x) => x.factor === f); return r ? BEHAVIOUR_BANK[r.mapping_id].flavour : null; };
  const summary = buildLumisCharacterSummary({ roleCode, ascFlavour: flav("ASC"), sunFlavour: flav("Sun"), moonFlavour: flav("Moon"), saturnFlavour: flav("Saturn"), mercuryFlavour: flav("Mercury") });
  return { summary, flav, card };
}

// #1 — every approved resolved factor for the role contributes to the summary.
test("#1 every resolved role factor contributes to the Lumis Character Summary (Spark keeps its Sun)", () => {
  const chart = { sun: 6, moon: 2, mercury: 5, saturn: 8, moon_confirmed: true }; // Ed
  for (const roleCode of Object.keys(ROLE_FACTORS)) {
    const { summary, flav } = summaryFor(roleCode, chart);
    for (const factor of ROLE_FACTORS[roleCode]) {
      const f = flav(factor);
      assert.ok(f, `${roleCode} resolves ${factor}`);
      // Each distinct factor flavour appears verbatim in the summary (reinforcement only when a
      // flavour repeats an earlier one — tested separately in #3).
      assert.ok(summary.includes(f!), `${roleCode}: ${factor} flavour "${f}" is expressed in the summary`);
    }
  }
  // The exact reported defect: Spark's Sun (Scorpio for Ed) must be present.
  const spark = summaryFor("harmonious_catalyst", chart);
  assert.ok(spark.summary.includes(spark.flav("Sun")!), "Spark Sun flavour present");
  assert.match(spark.summary, /driven by/);
});

// #3 — identical ASC + Moon flavours are reinforced once, not repeated verbatim.
test("#3 duplicate factor flavours are reinforced, not duplicated verbatim", () => {
  const dup = buildLumisCharacterSummary({ roleCode: "empathetic_peer", ascFlavour: "protective, receptive, emotionally aware", moonFlavour: "protective, receptive, emotionally aware", mercuryFlavour: "balanced, relational, diplomatic" });
  assert.equal((dup.match(/protective, receptive, emotionally aware/g) || []).length, 1, "flavour appears once");
  assert.match(dup, /especially/);
  assert.match(dup, /holding that presence/);
  // A real Rub Acceptance chart also must not duplicate (ASC Cancer + Moon Cancer).
  const rub = summaryFor("empathetic_peer", { sun: 7, moon: 4, mercury: 7, saturn: 9, moon_confirmed: true });
  assert.ok(!/(\b[\w-]+, [\w-]+, [\w-]+\b)(?=.*\1 as the conversation settles)/.test(rub.summary));
});

// #6 — failed turns are not eligible for the rolling model history; real completions are.
test("#6 failed turns are excluded from rolling model context; real completions are kept", () => {
  assert.equal(contextEligibleTurn("completed", "completed_text"), true);
  assert.equal(contextEligibleTurn("completed", null), true);
  assert.equal(contextEligibleTurn("router_unavailable", null), false);
  assert.equal(contextEligibleTurn("route_unavailable", null), false);
  assert.equal(contextEligibleTurn("technical_error", null), false);
  assert.equal(contextEligibleTurn("completed", "content_filtered_output"), false);
  assert.equal(contextEligibleTurn("completed", "content_filtered_input"), false);
  // Resend-after-failure = retry, not loop: two failed turns contribute nothing to history, so the
  // rolling context a resend would carry stays empty (no fallback text, no repeated-user "loop").
  const rolling: Array<{ role: string; text: string }> = [];
  for (const outcome of [{ r: "router_unavailable", d: null }, { r: "router_unavailable", d: null }]) {
    if (contextEligibleTurn(outcome.r, outcome.d)) rolling.push({ role: "assistant", text: "fallback" });
  }
  assert.equal(rolling.length, 0, "no failed fallback text enters rolling history");
});

// #7 — the full Prompt v3 identity (+arch_v3) is recorded on the persisted session.
test("#7 full +arch_v3 prompt version is recorded on the session", () => {
  assert.match(LAB_PROMPT_VERSION, /\+arch_v3$/);
  const out = handleSessionNew({ tester: "Founder", test_title: "v3-trace", role_code: "empathetic_peer", chart: { sun: 6, moon: 2, mercury: 5, saturn: 8, moon_confirmed: true }, app_language_preference: null }) as { status: number; body: { session: { prompt_version: string } } };
  assert.equal(out.status, 200);
  assert.equal(out.body.session.prompt_version, LAB_PROMPT_VERSION);
  assert.match(out.body.session.prompt_version, /\+arch_v3$/);
});
