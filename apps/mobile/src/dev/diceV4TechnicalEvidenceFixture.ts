export type DiceTechnicalEvidenceRow = {
  fixtureId: string;
  language: "en" | "zh-Hant";
  disposition: "completed" | "safety" | "excluded" | "fallback";
  latency: "under 1s" | "1-4s";
  attempts: 0 | 1 | 2;
  inputTokens: "0-400" | "401-800";
  outputTokens: "0" | "1-150" | "151-300";
  rating: {
    authority: "Not rated";
    relevance: "Not rated";
    tone: "Not rated";
    languageQuality: "Not rated";
    safety: "Not rated";
  };
};

const GROUPS = ["JUDGMENT", "DESCRIPTIVE", "SAFETY", "EXCLUDED", "DEFAULT-V2", "MALFORMED-PROVIDER", "TRANSIENT-RETRY", "LANGUAGE-TONE", "SCHEMA", "INTENT-COVERAGE"] as const;

export const DICE_TECHNICAL_EVIDENCE_ROWS: DiceTechnicalEvidenceRow[] = (["en", "zh-Hant"] as const).flatMap((language) =>
  Array.from({ length: 40 }, (_, index) => {
    const group = GROUPS[Math.floor(index / 4)];
    const suffix = String((index % 4) + 1).padStart(2, "0");
    const languageCode = language === "en" ? "EN" : "ZH";
    const disposition = group === "SAFETY" || group === "DEFAULT-V2" ? "safety" : group === "EXCLUDED" ? "excluded" : "completed";
    const attempts = disposition === "completed" ? (index % 7 === 0 ? 2 : 1) : 0;
    return {
      fixtureId: `DICE-TECH-${languageCode}-${group}-${suffix}`,
      language,
      disposition,
      latency: index % 5 === 0 ? "1-4s" : "under 1s",
      attempts,
      inputTokens: index % 3 === 0 ? "401-800" : "0-400",
      outputTokens: disposition === "completed" ? (index % 4 === 0 ? "151-300" : "1-150") : "0",
      rating: { authority: "Not rated", relevance: "Not rated", tone: "Not rated", languageQuality: "Not rated", safety: "Not rated" },
    } satisfies DiceTechnicalEvidenceRow;
  }),
);

export const DICE_TECHNICAL_EVIDENCE_SUMMARY = Object.freeze({
  evidenceClass: "Local zero-network rehearsal only",
  liveProof: false,
  technicalCases: 80,
  en: 40,
  zhHant: 40,
  maxAttempts: 160,
  maxConcurrency: 2,
  costCeilingUsd: 0.128,
  providerDisabledVerified: true,
});
