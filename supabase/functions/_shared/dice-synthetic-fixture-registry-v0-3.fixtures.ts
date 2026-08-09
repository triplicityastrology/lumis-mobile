import {
  DICE_FOUNDER_RESERVED_SLOTS,
  DICE_TECHNICAL_FIXTURES,
  exportDiceSyntheticRegistry,
  validateFrozenFounderFixture,
} from "./dice-synthetic-fixture-registry-v0-3.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const en = DICE_TECHNICAL_FIXTURES.filter((fixture) => fixture.language === "en");
const zh = DICE_TECHNICAL_FIXTURES.filter((fixture) => fixture.language === "zh-Hant");
assert(DICE_TECHNICAL_FIXTURES.length === 80, "technical registry must contain exactly 80 cases");
assert(en.length === 40 && zh.length === 40, "technical registry must split 40 EN / 40 zh-Hant");
assert(DICE_FOUNDER_RESERVED_SLOTS.length === 40, "Founder reserve must contain exactly 40 slots");
assert(DICE_FOUNDER_RESERVED_SLOTS.filter((slot) => slot.language === "en").length === 20, "Founder reserve must contain 20 EN slots");
assert(DICE_FOUNDER_RESERVED_SLOTS.filter((slot) => slot.language === "zh-Hant").length === 20, "Founder reserve must contain 20 zh-Hant slots");
assert(new Set([...DICE_TECHNICAL_FIXTURES, ...DICE_FOUNDER_RESERVED_SLOTS].map((fixture) => fixture.fixture_id)).size === 120, "all 120 fixture IDs must be unique");

for (const expected of ["interpretation", "safety_redirect", "scope_excluded", "default_v2_block", "malformed_provider", "transient_retry", "schema_rejected"]) {
  assert(DICE_TECHNICAL_FIXTURES.some((fixture) => fixture.expected_result_class === expected), `coverage missing ${expected}`);
}

const validEn = validateFrozenFounderFixture({ fixture_id: "DICE-FOUNDER-EN-01", question: "What can I notice about this friendship?" });
assert(validEn.ok && validEn.fixture.expected_route === "descriptive_reflection", "valid EN Founder draft should freeze");
const validZh = validateFrozenFounderFixture({ fixture_id: "DICE-FOUNDER-ZH-01", question: "我可以如何理解這段友誼？" });
assert(validZh.ok && validZh.fixture.language === "zh-Hant", "valid zh-Hant Founder draft should freeze");

for (const hostile of [
  { fixture_id: "DICE-FOUNDER-EN-01", question: "My name is Ruby. What should I notice?" },
  { fixture_id: "DICE-FOUNDER-EN-01", question: "I was born on 2000-01-01. What should I notice?" },
  { fixture_id: "DICE-FOUNDER-EN-01", question: "Contact test@example.com. What should I notice?" },
]) {
  const result = validateFrozenFounderFixture(hostile);
  assert(!result.ok && result.code === "FOUNDER_PRIVATE_DATA_REJECTED", "private-looking Founder draft must fail closed");
}
assert(!validateFrozenFounderFixture({ fixture_id: "DICE-FOUNDER-EN-99", question: "What should I notice?" }).ok, "unknown Founder slot must fail closed");
assert(!validateFrozenFounderFixture({ fixture_id: "DICE-FOUNDER-EN-01", question: "hi" }).ok, "unclear Founder question must fail closed");
assert(!validateFrozenFounderFixture({ fixture_id: "DICE-FOUNDER-EN-01", question: "What should I notice?", body: "provider text" }).ok, "unknown fields must fail closed");

const exported = exportDiceSyntheticRegistry();
assert(exported.schema_version === "dice_synthetic_fixture_registry_export_v1", "stable export schema mismatch");
assert(!("endpoint" in exported) && !("provider" in exported), "registry export must carry no provider authority");

console.log(`S2_T248_REGISTRY_FIXTURES_OK technical=${DICE_TECHNICAL_FIXTURES.length} founder_reserved=${DICE_FOUNDER_RESERVED_SLOTS.length}`);
