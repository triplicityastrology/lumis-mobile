// Closed, server-held LIVE registry: exactly 12 synthetic Chat fixtures (6 EN + 6 zh-Hant).
//
// The fixture identities and frozen texts are REUSED from the T350 founder-chat window:
//   - allowlist:  FOUNDER_CHAT_FIXTURE_IDS  (supabase/functions/_shared/founder-chat-window-v1.ts)
//   - frozen text: getChatSyntheticFixture   (supabase/functions/_shared/chat-synthetic-registry-v1.ts)
// This module binds each fixture to a FROZEN (role, chart) test context so the Lab's Chart
// Composition / decision-trace panels still render for live cases. Nothing here is editable at
// runtime, and no browser text can enter this registry.

import { createHash } from "node:crypto";
import { FOUNDER_CHAT_FIXTURE_IDS } from "../../../supabase/functions/_shared/founder-chat-window-v1.ts";
import { getChatSyntheticFixture, type SyntheticLanguage } from "../../../supabase/functions/_shared/chat-synthetic-registry-v1.ts";
import type { LabRoleCode } from "./lab-constants.ts";

type Chart = { sun: number; moon: number; mercury: number; saturn: number; moon_confirmed: boolean };

// Frozen per-slug (role, chart) bindings. Synthetic test contexts only — no member data.
const SLUG_BINDING: Record<string, { roleCode: LabRoleCode; chart: Chart }> = {
  small_decision: { roleCode: "empathetic_peer", chart: { sun: 3, moon: 6, mercury: 3, saturn: 10, moon_confirmed: true } },
  difficult_conversation: { roleCode: "harmonious_catalyst", chart: { sun: 2, moon: 4, mercury: 8, saturn: 10, moon_confirmed: false } },
  uncertain_change: { roleCode: "saturnian_anchor", chart: { sun: 1, moon: 8, mercury: 1, saturn: 10, moon_confirmed: true } },
  rest_without_guilt: { roleCode: "empathetic_peer", chart: { sun: 4, moon: 4, mercury: 6, saturn: 1, moon_confirmed: true } },
  boundary: { roleCode: "saturnian_anchor", chart: { sun: 5, moon: 1, mercury: 12, saturn: 1, moon_confirmed: false } },
  unsafe_medical: { roleCode: "empathetic_peer", chart: { sun: 6, moon: 6, mercury: 6, saturn: 6, moon_confirmed: true } },
};

export type LiveFixture = Readonly<{
  id: string;
  language: SyntheticLanguage;
  slug: string;
  roleCode: LabRoleCode;
  chart: Chart;
  expectedClass: "reflection" | "safety";
  serverPromptInput: string; // frozen synthetic message text (server-held)
}>;

function slugFromId(id: string): string {
  return id.replace(/^chat_(en|zh_hant)_/, "").replace(/_v1$/, "");
}

const LIVE: readonly LiveFixture[] = Object.freeze(
  FOUNDER_CHAT_FIXTURE_IDS.map((id) => {
    const base = getChatSyntheticFixture(id);
    if (!base) throw new Error(`LAB_LIVE_FIXTURE_MISSING:${id}`);
    const slug = slugFromId(id);
    const binding = SLUG_BINDING[slug];
    if (!binding) throw new Error(`LAB_LIVE_BINDING_MISSING:${slug}`);
    return Object.freeze({
      id: base.id,
      language: base.language,
      slug,
      roleCode: binding.roleCode,
      chart: binding.chart,
      expectedClass: base.expectedClass,
      serverPromptInput: base.serverPromptInput,
    });
  }),
);

const byId = new Map(LIVE.map((f) => [f.id, f]));

export const LIVE_FIXTURE_IDS: readonly string[] = Object.freeze(LIVE.map((f) => f.id));
export const LIVE_FIXTURE_COUNT = LIVE.length;

export function getLiveFixture(id: string): LiveFixture | undefined {
  return byId.get(id);
}

export function listLiveFixtures(): readonly LiveFixture[] {
  return LIVE;
}

// Non-secret listing for the UI (id, language, slug label, frozen preview text).
export function listLiveFixturesForUi() {
  return LIVE.map((f) => ({ id: f.id, language: f.language, slug: f.slug, preview: f.serverPromptInput, expected_class: f.expectedClass }));
}

export function liveLanguageCounts(): { en: number; "zh-Hant": number } {
  return {
    en: LIVE.filter((f) => f.language === "en").length,
    "zh-Hant": LIVE.filter((f) => f.language === "zh-Hant").length,
  };
}

// Deterministic registry checksum over the 12 frozen bound fixtures (stable key order).
export function computeRegistryChecksum(): string {
  const canonical = JSON.stringify(
    [...LIVE]
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .map((f) => ({
        id: f.id, language: f.language, slug: f.slug, roleCode: f.roleCode,
        chart: { sun: f.chart.sun, moon: f.chart.moon, mercury: f.chart.mercury, saturn: f.chart.saturn, moon_confirmed: f.chart.moon_confirmed },
        expectedClass: f.expectedClass, serverPromptInput: f.serverPromptInput,
      })),
  );
  return createHash("sha256").update(canonical).digest("hex");
}
