export type PersonaComparisonPublicName = "Acceptance" | "Spark" | "Awareness";

export type PersonaComparisonEvidence = {
  publicName: PersonaComparisonPublicName;
  contractChecklist: readonly string[];
  profileStatus: "resolved" | "fallback_applied";
  profileStatusLabel: string;
  payloadStatus: "ready";
  payloadStatusLabel: string;
  fixtureNote: string;
};

export const PERSONA_COMPARISON_SAMPLE =
  "I feel overwhelmed and need help deciding what to handle first.";

export const PERSONA_COMPARISON_EVIDENCE: readonly PersonaComparisonEvidence[] = [
  {
    publicName: "Acceptance",
    contractChecklist: [
      "Reflect the feeling before organising the problem.",
      "Ask whether listening or light help is wanted.",
      "Do not confirm harmful or catastrophic conclusions.",
    ],
    profileStatus: "fallback_applied",
    profileStatusLabel: "Available with approved neutral Moon fallback",
    payloadStatus: "ready",
    payloadStatusLabel: "Deterministic fixture payload ready",
    fixtureNote: "Local evidence fixture only. This is not a live AI response.",
  },
  {
    publicName: "Spark",
    contractChecklist: [
      "Offer one or two fresh perspectives.",
      "Encourage choice without pressure.",
      "Pause humour when distress is high.",
    ],
    profileStatus: "resolved",
    profileStatusLabel: "Resolved profile available",
    payloadStatus: "ready",
    payloadStatusLabel: "Deterministic fixture payload ready",
    fixtureNote: "Local evidence fixture only. This is not a live AI response.",
  },
  {
    publicName: "Awareness",
    contractChecklist: [
      "Name no more than one meaningful blind spot.",
      "Explain the reasoning and offer one practical step.",
      "Use structure without blame, shame, or obedience.",
    ],
    profileStatus: "fallback_applied",
    profileStatusLabel: "Available with approved stable-boundary fallback",
    payloadStatus: "ready",
    payloadStatusLabel: "Deterministic fixture payload ready",
    fixtureNote: "Local evidence fixture only. This is not a live AI response.",
  },
] as const;

export function getPersonaComparisonEvidence(
  publicName: PersonaComparisonPublicName
): PersonaComparisonEvidence {
  const evidence = PERSONA_COMPARISON_EVIDENCE.find((entry) => entry.publicName === publicName);
  if (!evidence) throw new Error("PERSONA_COMPARISON_FIXTURE_UNAVAILABLE");
  return evidence;
}
