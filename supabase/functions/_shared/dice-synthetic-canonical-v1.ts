import {
  DICE_FOUNDER_RESERVED_SLOTS,
  DICE_TECHNICAL_FIXTURES,
} from "./dice-synthetic-fixture-registry-v0-3.ts";
import {
  DICE_V03_PROMPT_VERSION,
  DICE_V03_RESULT_SCHEMA,
  buildDiceV03Prompt,
  parseDiceV03ModelResult,
} from "./dice-v0-3-interpretation-contract.ts";

export const DICE_GATEWAY_INTERFACE_VERSION = "dice_synthetic_gateway_port_v1" as const;
export const DICE_AUTHORIZATION_SCHEMA = "lumis_dice_default_off_deployment_authorization_v2" as const;
export const DICE_REGISTRY_VERSION = "lumis_dice_synthetic_registry_v1" as const;
export const DICE_PROMPT_VERSION = DICE_V03_PROMPT_VERSION;
export const DICE_RESPONSE_SCHEMA = DICE_V03_RESULT_SCHEMA;
export const DICE_EVIDENCE_SCHEMA = "lumis_dice_synthetic_metadata_evidence_v1" as const;

export const DICE_LIMITS = Object.freeze({
  technicalCases: 80,
  founderCasesExecutable: 0,
  providerAttempts: 160,
  // Raised 800 -> 1600 for the v3 prompt (route hierarchy, synthesis, dignity,
  // route sanity check). Worst measured assembled request ~1194 tokens; 1600
  // keeps headroom for a 280-char question without truncating required rules
  // (prompt-quality handoff §8.5).
  inputTokens: 1600,
  outputTokens: 300,
  concurrency: 2,
  retries: 1,
  caseDeadlineMs: 12_000,
  evidenceRetentionDays: 30,
  authorizationMaxFutureMs: 15 * 60 * 1000,
});

export const DICE_RESULT_CLASSES = Object.freeze([
  "completed",
  "safety",
  "excluded",
  "fallback",
  "technical_error",
] as const);

export const DICE_FAILURE_CODES = Object.freeze([
  "none",
  "safety_block",
  "scope_excluded",
  "input_token_cap",
  "output_token_cap",
  "provider_timeout",
  "provider_rate_limited",
  "provider_unavailable",
  "provider_malformed",
  "provider_authentication",
  "provider_permission",
  "defaultv2_block",
  "defaultv2_partial",
  "attempt_cap",
] as const);

export type DiceLanguage = "en" | "zh-Hant";
export type DiceResultClass = typeof DICE_RESULT_CLASSES[number];
export type DiceFailureCode = typeof DICE_FAILURE_CODES[number];

export type CanonicalDiceFixture = Readonly<{
  fixture_id: string;
  phase: "technical";
  language: DiceLanguage;
  question: string;
  classification: "judgment" | "descriptive";
  expected_result_class: DiceResultClass;
  outcome: Readonly<{ planet: string; sign: string; house: string }>;
}>;

const LANDINGS = Object.freeze([
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

const FIXTURE_ID = /^DICE-(TECH-(EN|ZH)-[A-Z0-9]+(?:-[A-Z0-9]+)*-[0-9]{2}|FOUNDER-(EN|ZH)-[0-9]{2})$/;

function resultClass(value: string): DiceResultClass {
  if (value === "safety_redirect" || value === "default_v2_block") return "safety";
  if (value === "scope_excluded") return "excluded";
  if (value === "malformed_provider" || value === "schema_rejected") return "fallback";
  return "completed";
}

const TECHNICAL = DICE_TECHNICAL_FIXTURES.map((fixture, index): CanonicalDiceFixture => Object.freeze({
  fixture_id: fixture.fixture_id,
  phase: "technical",
  language: fixture.language,
  question: fixture.question,
  classification: fixture.expected_route === "judgment" ? "judgment" : "descriptive",
  expected_result_class: resultClass(fixture.expected_result_class),
  outcome: LANDINGS[index % LANDINGS.length],
}));

if (TECHNICAL.length !== DICE_LIMITS.technicalCases || DICE_FOUNDER_RESERVED_SLOTS.length !== 40) {
  throw new Error("DICE_CANONICAL_REGISTRY_COUNT_INVALID");
}
if ([...TECHNICAL, ...DICE_FOUNDER_RESERVED_SLOTS].some((fixture) => !FIXTURE_ID.test(fixture.fixture_id))) {
  throw new Error("DICE_CANONICAL_FIXTURE_ID_INVALID");
}

const TECHNICAL_BY_ID = new Map(TECHNICAL.map((fixture) => [fixture.fixture_id, fixture]));
const FOUNDER_IDS = new Set(DICE_FOUNDER_RESERVED_SLOTS.map((fixture) => fixture.fixture_id));

export const canonicalDiceRegistry = Object.freeze({
  version: DICE_REGISTRY_VERSION,
  technicalFixtures: Object.freeze(TECHNICAL),
  founderFixtureIds: Object.freeze(DICE_FOUNDER_RESERVED_SLOTS.map((fixture) => fixture.fixture_id)),
  getTechnicalFixture(fixtureId: string): CanonicalDiceFixture | null {
    return TECHNICAL_BY_ID.get(fixtureId) ?? null;
  },
  isFounderProhibited(fixtureId: string): boolean {
    return FOUNDER_IDS.has(fixtureId);
  },
});

export function isCanonicalFixtureId(value: unknown): value is string {
  return typeof value === "string" && FIXTURE_ID.test(value);
}

export function assembleCanonicalDicePrompt(fixture: CanonicalDiceFixture): string {
  return buildDiceV03Prompt({
    fixture_id: fixture.fixture_id,
    question: fixture.question,
    language: fixture.language,
    question_shape: fixture.classification,
    outcome: fixture.outcome,
  });
}

export function parseCanonicalDiceOutput(content: string, fixture: Pick<CanonicalDiceFixture, "language" | "classification">): boolean {
  return parseDiceV03ModelResult(content, { language: fixture.language, question_shape: fixture.classification }) !== null;
}
