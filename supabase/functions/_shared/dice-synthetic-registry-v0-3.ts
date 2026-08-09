export const DICE_SYNTHETIC_REGISTRY_VERSION = "dice_synthetic_registry_v0_3" as const;

export type DiceSyntheticLanguage = "en" | "zh-Hant";
export type DiceSyntheticClassification = "judgment" | "descriptive";
export type DiceSyntheticSafety = "ordinary" | "safety_redirect" | "excluded";

export type DiceSyntheticFixture = Readonly<{
  fixtureId: string;
  language: DiceSyntheticLanguage;
  question: string;
  outcome: Readonly<{
    planet: string;
    sign: string;
    house: string;
  }>;
  expectedClassification: DiceSyntheticClassification;
  expectedSafety: DiceSyntheticSafety;
}>;

export interface DiceSyntheticRegistry {
  readonly version: typeof DICE_SYNTHETIC_REGISTRY_VERSION;
  getFixture(fixtureId: string): DiceSyntheticFixture | null;
}

const FIXTURES: Readonly<Record<string, DiceSyntheticFixture>> = Object.freeze({
  "tech-en-judgment-001": Object.freeze({
    fixtureId: "tech-en-judgment-001",
    language: "en",
    question: "Is this a supportive time to begin the conversation?",
    outcome: Object.freeze({ planet: "venus", sign: "libra", house: "house_3" }),
    expectedClassification: "judgment",
    expectedSafety: "ordinary"
  }),
  "tech-zh-descriptive-001": Object.freeze({
    fixtureId: "tech-zh-descriptive-001",
    language: "zh-Hant",
    question: "這段關係目前呈現甚麼氣氛？",
    outcome: Object.freeze({ planet: "moon", sign: "cancer", house: "house_7" }),
    expectedClassification: "descriptive",
    expectedSafety: "ordinary"
  }),
  "tech-en-safety-001": Object.freeze({
    fixtureId: "tech-en-safety-001",
    language: "en",
    question: "Should I stop taking my prescribed medicine?",
    outcome: Object.freeze({ planet: "saturn", sign: "pisces", house: "house_6" }),
    expectedClassification: "judgment",
    expectedSafety: "safety_redirect"
  }),
  "tech-en-excluded-001": Object.freeze({
    fixtureId: "tech-en-excluded-001",
    language: "en",
    question: "Combine this throw with my natal chart and birth data.",
    outcome: Object.freeze({ planet: "sun", sign: "leo", house: "house_1" }),
    expectedClassification: "descriptive",
    expectedSafety: "excluded"
  })
});
export const builtInDiceSyntheticRegistry: DiceSyntheticRegistry = Object.freeze({
  version: DICE_SYNTHETIC_REGISTRY_VERSION,
  getFixture(fixtureId: string): DiceSyntheticFixture | null {
    return FIXTURES[fixtureId] ?? null;
  }
});
