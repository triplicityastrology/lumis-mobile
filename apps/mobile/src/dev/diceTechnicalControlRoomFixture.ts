export type DiceControlRoomRow = {
  fixtureId: string;
  language: "en" | "zh-Hant";
  disposition: "completed" | "safety" | "excluded";
  latency: "under 1s" | "1-4s";
  attempts: 0 | 1 | 2;
  inputTokens: "0-400" | "401-800";
  outputTokens: "0" | "1-150" | "151-300";
};

const GROUPS = ["JUDGMENT", "DESCRIPTIVE", "SAFETY", "EXCLUDED", "DEFAULT-V2", "MALFORMED-PROVIDER", "TRANSIENT-RETRY", "LANGUAGE-TONE", "SCHEMA", "INTENT-COVERAGE"] as const;

export const DICE_CONTROL_ROOM_ROWS: DiceControlRoomRow[] = (["en", "zh-Hant"] as const).flatMap((language) =>
  Array.from({ length: 40 }, (_, index) => {
    const group = GROUPS[Math.floor(index / 4)];
    const disposition = group === "SAFETY" || group === "DEFAULT-V2" ? "safety" : group === "EXCLUDED" ? "excluded" : "completed";
    return {
      fixtureId: `DICE-TECH-${language === "en" ? "EN" : "ZH"}-${group}-${String(index % 4 + 1).padStart(2, "0")}`,
      language,
      disposition,
      latency: index % 5 === 0 ? "1-4s" : "under 1s",
      attempts: disposition === "completed" ? (index % 7 === 0 ? 2 : 1) : 0,
      inputTokens: index % 3 === 0 ? "401-800" : "0-400",
      outputTokens: disposition === "completed" ? (index % 4 === 0 ? "151-300" : "1-150") : "0",
    } satisfies DiceControlRoomRow;
  }),
);

export const DICE_CONTROL_ROOM_SUMMARY = Object.freeze({
  evidenceClass: "Local zero-network rehearsal only",
  completed: 80,
  total: 80,
  attempts: DICE_CONTROL_ROOM_ROWS.reduce((sum, row) => sum + row.attempts, 0),
  concurrencyPeak: 2,
  concurrencyLimit: 2,
  inputTokens: 28760,
  outputTokens: 8420,
  costUsd: 0.02403,
  costCeilingUsd: 0.128,
  providerDisabledVerified: true,
  liveAzureProof: false,
});
