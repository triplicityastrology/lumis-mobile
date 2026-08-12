import {
  FOUNDER_ENGLISH_DRAFTS,
  FOUNDER_EXCLUDED_ZH_AUTHORING_ID,
  FOUNDER_ZH_HANT_DRAFTS,
  type FounderDraftLanguage,
} from "../dev/founderDiceQuestionBank";

export const DICE_FOUNDER_FIXTURE_REGISTRY_VERSION = "dice_founder_fixture_registry_v1" as const;
export const DICE_FOUNDER_FIXTURE_REGISTRY_SHA256 = "0c1ae651046f67482588ecb8a5eaaa71aff66d97c7e22806d3a06370b622e06b" as const;

export type DiceFounderFixture = Readonly<{
  fixture_id: string;
  authoring_id: string;
  language: FounderDraftLanguage;
  exact_text: string;
}>;

function fixturesForLanguage(
  language: FounderDraftLanguage,
  drafts: readonly Readonly<{ authoring_id: string; language: FounderDraftLanguage; exact_text: string }>[],
): DiceFounderFixture[] {
  const languageCode = language === "en" ? "en" : "zh";
  return drafts.map((draft, index) => Object.freeze({
    fixture_id: `dice-founder-${languageCode}-${String(index + 1).padStart(2, "0")}`,
    authoring_id: draft.authoring_id,
    language,
    exact_text: draft.exact_text,
  }));
}

const approvedZhHantDrafts = FOUNDER_ZH_HANT_DRAFTS.filter(
  (draft) => draft.authoring_id !== FOUNDER_EXCLUDED_ZH_AUTHORING_ID,
);

export const DICE_FOUNDER_FIXTURES: readonly DiceFounderFixture[] = Object.freeze([
  ...fixturesForLanguage("en", FOUNDER_ENGLISH_DRAFTS),
  ...fixturesForLanguage("zh-Hant", approvedZhHantDrafts),
]);

const fixturesById = new Map(DICE_FOUNDER_FIXTURES.map((fixture) => [fixture.fixture_id, fixture]));
const fixturesByAuthoringId = new Map(DICE_FOUNDER_FIXTURES.map((fixture) => [fixture.authoring_id, fixture]));

export function resolveDiceFounderFixture(fixtureId: string): DiceFounderFixture | null {
  return fixturesById.get(fixtureId) ?? null;
}

export function resolveDiceFounderFixtureByAuthoringId(authoringId: string): DiceFounderFixture | null {
  return fixturesByAuthoringId.get(authoringId) ?? null;
}
