import {
  PERSONA_COMPARISON_EVIDENCE,
  PERSONA_COMPARISON_SAMPLE,
  getPersonaComparisonEvidence,
} from "./personaComparisonFixture";

equal(PERSONA_COMPARISON_EVIDENCE.length, 3, "three public personas");
equal(PERSONA_COMPARISON_EVIDENCE.map((entry) => entry.publicName).join("|"), "Acceptance|Spark|Awareness", "public names stay unchanged");
equal(new Set(PERSONA_COMPARISON_EVIDENCE.map((entry) => entry.fixtureNote)).size, 1, "same fixture disclosure");
equal(PERSONA_COMPARISON_SAMPLE.length > 0, true, "one shared sample situation");

for (const entry of PERSONA_COMPARISON_EVIDENCE) {
  equal(entry.contractChecklist.length, 3, `${entry.publicName} checklist`);
  equal(entry.payloadStatus, "ready", `${entry.publicName} payload readiness`);
  equal(entry.fixtureNote.includes("not a live AI response"), true, `${entry.publicName} truthful fixture label`);
  equal(getPersonaComparisonEvidence(entry.publicName), entry, `${entry.publicName} deterministic lookup`);
}

console.log("persona comparison fixture adapter passed");

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: assertion failed`);
}
