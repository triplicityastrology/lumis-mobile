// Character Voice source for the Lab. The 60 approved behaviour-mapping rows are NOT duplicated here:
// they are DERIVED from the single shared canonical source (persona-behavior-mapping-v1.ts), generated
// from the controlled Persona Behaviour Mapping workbook and consumed by the persona pipeline and the
// future mobile Normal Chat route. The model receives each row's primary behaviour via the Character
// Voice card; the Lab never invents behaviour from a sign name.
//
// AP-5a (Founder-approved 2026-08-23): nine rows were reworded from compulsory conversational actions
// ("validate first / organise / offer choices / ask / give one next step") into character manner, in
// the shared source. This Lab view inherits them automatically - one canonical source, no drift.

import { buildCombinedCharacter } from "../../../supabase/functions/_shared/companion-voice-and-naturalness-v1.ts";
import { PERSONA_BEHAVIOR_MAPPING_V1 } from "../../../supabase/functions/_shared/persona-behavior-mapping-v1.ts";

export type BehaviourRow = { factor: string; sign: string; layer: string; flavour: string; primary: string; moves: string; version: string };
// Bumped on the AP-5a content rewrite (row wording changed; row set + schema unchanged).
export const BEHAVIOUR_MAPPING_VERSION = "v1.3" as const;

// Derived view of the shared canonical mapping, keyed by mappingId (e.g. "asc_cancer").
export const BEHAVIOUR_BANK: Record<string, BehaviourRow> = Object.fromEntries(
  PERSONA_BEHAVIOR_MAPPING_V1.map((r) => [r.mappingId, {
    factor: r.factor, sign: r.sign, layer: r.behaviorLayer, flavour: r.signFlavor,
    primary: r.primaryBehavior, moves: r.recommendedMoves, version: r.version,
  } as BehaviourRow]),
);

// ---- Character Voice Card builder ----
// Retrieves exactly one approved mapping row per calculated factor (factor + resolved sign +
// behaviour-mapping version) and compiles them into an operational Character Voice, ordered by the
// approved precedence ASC -> Sun/Moon/Saturn -> Mercury. The "Combined character" is synthesised
// DETERMINISTICALLY from the workbook's sign-flavour fields + a fixed template — no invented stereotypes.

export type VoiceRow = { factor: string; sign: string; mapping_id: string; version: string; layer: string; instruction: string; moves: string; included: boolean };
export type VoiceCard = { role_code: string; role_label: string; rows: VoiceRow[]; card_text: string };

const FACTOR_ORDER = ["ASC", "Sun", "Moon", "Saturn", "Mercury"];

type CompFactor = { factor?: string; sign?: string };
type Comp = { available?: boolean; factors?: ReadonlyArray<CompFactor> };

export function buildVoiceCard(composition: Comp, roleLabel: string, roleCode: string): VoiceCard | null {
  if (!composition || composition.available === false || !Array.isArray(composition.factors)) return null;
  const factors = composition.factors.filter((f) => f && f.factor && f.sign)
    .slice().sort((a, b) => FACTOR_ORDER.indexOf(a.factor as string) - FACTOR_ORDER.indexOf(b.factor as string));
  const rows: VoiceRow[] = [];
  for (const f of factors) {
    const mid = `${(f.factor as string).toLowerCase()}_${(f.sign as string).toLowerCase()}`;
    const row = BEHAVIOUR_BANK[mid];
    if (!row) continue;
    rows.push({ factor: f.factor as string, sign: f.sign as string, mapping_id: mid, version: row.version, layer: row.layer, instruction: row.primary, moves: row.moves, included: true });
  }
  if (!rows.length) return null;
  const lines: string[] = ["LUMIS CHARACTER VOICE", `Role: ${roleLabel} / ${roleCode}`, ""];
  for (const r of rows) lines.push(`${r.layer} — ${r.factor} ${r.sign}:\n${r.instruction}\n`);
  lines.push("Combined character:");
  lines.push(combinedCharacter(rows));
  return { role_code: roleCode, role_label: roleLabel, rows, card_text: lines.join("\n") };
}

// Manner-based Character Voice synthesis (AP-4). The synthesis WORDING is the shared canonical source
// (companion-voice-and-naturalness-v1.ts); this function supplies the resolved factor flavours from
// the approved behaviour mapping (BEHAVIOUR_BANK, unchanged — mapping-row wording AP-5 is deferred).
function combinedCharacter(rows: VoiceRow[]): string {
  const flavour = (factor: string): string | null => {
    const r = rows.find((x) => x.factor === factor);
    return r ? BEHAVIOUR_BANK[r.mapping_id].flavour : null;
  };
  return buildCombinedCharacter({
    asc: flavour("ASC"), sun: flavour("Sun"), moon: flavour("Moon"),
    saturn: flavour("Saturn"), mercury: flavour("Mercury"),
  });
}
