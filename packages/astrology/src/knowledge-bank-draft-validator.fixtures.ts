import {
  KNOWLEDGE_BANK_DRAFT_MANIFEST_VERSION,
  KNOWLEDGE_BANK_DRAFT_RECORD_VERSION,
  compileKnowledgeBankDraftManifest,
  type KnowledgeBankDraftFailureCode,
} from "./knowledge-bank-draft-validator";

const validPlanet = record({
  recordId: "sun",
  recordType: "planet",
  scopeTags: ["natal_core"],
});
const validHouse = record({
  recordId: "house_10",
  recordType: "house",
  scopeTags: ["natal_deep", "timing_future"],
  capabilityRequirements: ["birth_time_supplied", "houses_available"],
  sourceRuleVersion: "traditional_house_ruler_v1",
});

const compiled = compileKnowledgeBankDraftManifest([
  validHouse,
  validPlanet,
]);
equal(compiled.ok, true, "valid draft records compile");
if (compiled.ok) {
  equal(
    compiled.value.schemaVersion,
    KNOWLEDGE_BANK_DRAFT_MANIFEST_VERSION,
    "manifest version"
  );
  equal(compiled.value.recordCount, 2, "manifest count");
  equal(
    compiled.value.records.map((item) => item.recordId).join(","),
    "house_10,sun",
    "manifest order is deterministic"
  );
  doesNotMatch(
    JSON.stringify(compiled.value),
    /core function|constructive draft|challenging draft|grounding draft|mobile draft/i,
    "manifest contains no authored interpretation text"
  );
}

expectFailure(
  [validPlanet, { ...validPlanet }],
  "KB_DRAFT_DUPLICATE_RECORD_ID",
  "duplicate IDs"
);
expectFailure(
  [
    {
      ...validPlanet,
      scopeTags: ["natal_core", "premium_plan"],
    },
  ],
  "KB_DRAFT_SCOPE_TAG_INVALID",
  "malformed scope tag"
);
expectFailure(
  [
    {
      ...validPlanet,
      recordId: "dice_sun",
    },
  ],
  "KB_DRAFT_PROHIBITED_SCOPE",
  "Dice record"
);
for (const [label, contamination] of [
  ["Solar Return", { recordId: "solar_return_sun" }],
  ["transit", { recordId: "transit_sun" }],
  ["Vertex", { recordId: "vertex" }],
  ["annual theme", { recordId: "annual_theme" }],
  [
    "timing execution",
    {
      content: {
        ...validPlanet.content,
        groundingInstruction: "Run timing calculation for this date.",
      },
    },
  ],
  [
    "provider configuration",
    {
      metadata: {
        ...validPlanet.metadata,
        sourceBasis: "provider configuration",
      },
    },
  ],
  [
    "generated interpretation",
    {
      content: {
        ...validPlanet.content,
        contentKind: "generated_interpretation",
      },
    },
  ],
] as const) {
  expectFailure(
    [{ ...validPlanet, ...contamination }],
    label === "generated interpretation"
      ? "KB_DRAFT_CONTENT_INVALID"
      : "KB_DRAFT_PROHIBITED_SCOPE",
    label
  );
}

const privateFailure = compileKnowledgeBankDraftManifest([
  {
    ...validPlanet,
    unexpected: "private workbook text must not echo",
  },
]);
equal(privateFailure.ok, false, "unknown field rejected");
doesNotMatch(
  JSON.stringify(privateFailure),
  /private workbook text|unexpected/i,
  "failure is non-echoing"
);

console.log("Knowledge Bank draft structural fixtures passed");

function record(input: {
  recordId: string;
  recordType: string;
  scopeTags: string[];
  capabilityRequirements?: string[];
  sourceRuleVersion?: string;
}) {
  return {
    schemaVersion: KNOWLEDGE_BANK_DRAFT_RECORD_VERSION,
    recordId: input.recordId,
    recordType: input.recordType,
    scopeTags: input.scopeTags,
    language: "en",
    content: {
      contentKind: "atomic_draft",
      name: "Synthetic record",
      coreFunction: "Core function draft",
      keywords: ["synthetic", "fixture"],
      constructiveExpression: "Constructive draft",
      challengingExpression: "Challenging draft",
      groundingInstruction: "Grounding draft",
      mobileSummary: "Mobile draft",
    },
    metadata: {
      sourceBasis: "canonical v0.2 development draft",
      reviewStatus: "not_reviewed",
      contentVersion: "kb_draft_0.2",
      capabilityRequirements: input.capabilityRequirements ?? [],
      ...(input.sourceRuleVersion
        ? { sourceRuleVersion: input.sourceRuleVersion }
        : {}),
    },
  };
}

function expectFailure(
  input: unknown,
  expectedCode: KnowledgeBankDraftFailureCode,
  label: string
): void {
  const result = compileKnowledgeBankDraftManifest(input);
  equal(result.ok, false, `${label} rejected`);
  if (!result.ok) {
    equal(result.error.code, expectedCode, `${label} safe code`);
    equal(
      Object.keys(result.error).sort().join(","),
      "code,location,reason",
      `${label} safe failure shape`
    );
  }
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: assertion failed`);
  }
}

function doesNotMatch(value: string, pattern: RegExp, label: string): void {
  if (pattern.test(value)) {
    throw new Error(`${label}: prohibited output`);
  }
}
