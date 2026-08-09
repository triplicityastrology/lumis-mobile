import {
  DICE_TECHNICAL_FIXTURES,
  type DiceSyntheticFixture as ReviewedFixture,
} from "./dice-synthetic-fixture-registry-v0-3.ts";
import {
  DICE_SYNTHETIC_REGISTRY_VERSION,
  type DiceSyntheticFixture,
  type DiceSyntheticRegistry,
} from "./dice-synthetic-registry-v0-3.ts";

const SYNTHETIC_LANDINGS = Object.freeze([
  Object.freeze({ planet: "sun", sign: "leo", house: "house_1" }),
  Object.freeze({ planet: "moon", sign: "cancer", house: "house_4" }),
  Object.freeze({ planet: "mercury", sign: "gemini", house: "house_3" }),
  Object.freeze({ planet: "venus", sign: "libra", house: "house_7" }),
  Object.freeze({ planet: "mars", sign: "aries", house: "house_8" }),
  Object.freeze({ planet: "jupiter", sign: "sagittarius", house: "house_9" }),
  Object.freeze({ planet: "saturn", sign: "capricorn", house: "house_10" }),
  Object.freeze({ planet: "uranus", sign: "aquarius", house: "house_11" }),
  Object.freeze({ planet: "neptune", sign: "pisces", house: "house_12" }),
  Object.freeze({ planet: "pluto", sign: "scorpio", house: "house_6" }),
]);

const fixtures = new Map<string, DiceSyntheticFixture>(
  DICE_TECHNICAL_FIXTURES.map((fixture, index) => [
    fixture.fixture_id,
    adaptFixture(fixture, index),
  ]),
);

export const reviewedDiceSyntheticRegistry: DiceSyntheticRegistry = Object.freeze({
  version: DICE_SYNTHETIC_REGISTRY_VERSION,
  getFixture(fixtureId: string): DiceSyntheticFixture | null {
    return fixtures.get(fixtureId) ?? null;
  },
});

function adaptFixture(fixture: ReviewedFixture, index: number): DiceSyntheticFixture {
  const expectedSafety = fixture.expected_result_class === "safety_redirect"
    ? "safety_redirect"
    : fixture.expected_result_class === "scope_excluded"
      ? "excluded"
      : "ordinary";
  return Object.freeze({
    fixtureId: fixture.fixture_id,
    language: fixture.language,
    question: fixture.question,
    outcome: SYNTHETIC_LANDINGS[index % SYNTHETIC_LANDINGS.length],
    expectedClassification: fixture.expected_route === "judgment" ? "judgment" : "descriptive",
    expectedSafety,
  });
}
