import {
  KNOWLEDGE_BANK_DRAFT_MANIFEST_VERSION,
  KNOWLEDGE_BANK_DRAFT_RECORD_VERSION,
  compileKnowledgeBankDraftManifest,
  type KnowledgeBankDraftFailureCode,
} from "./knowledge-bank-draft-validator";

const natalCore = record({
  recordId: "fixture_natal_core",
  scopeTags: ["natal_core"],
});
const natalDeep = record({
  recordId: "fixture_natal_deep",
  scopeTags: ["natal_deep"],
  capabilityRequirements: ["birth_time_supplied", "houses_available"],
});
const timingFuture = record({
  recordId: "fixture_timing_future",
  scopeTags: ["timing_future"],
});

const valid = compileKnowledgeBankDraftManifest([
  timingFuture,
  natalDeep,
  natalCore,
]);
equal(valid.ok, true, "all approved structural scopes compile");
if (valid.ok) {
  equal(
    valid.value.schemaVersion,
    KNOWLEDGE_BANK_DRAFT_MANIFEST_VERSION,
    "manifest version"
  );
  equal(
    valid.value.records.map((item) => item.recordId).join(","),
    "fixture_natal_core,fixture_natal_deep,fixture_timing_future",
    "manifest order"
  );
  equal(
    valid.value.records.find(
      (item) => item.recordId === "fixture_timing_future"
    )?.scopeTags[0],
    "timing_future",
    "non-executing future tag retained"
  );
  doesNotMatch(
    JSON.stringify(valid.value),
    /fixture_name|fixture_core|fixture_constructive|fixture_challenging|fixture_grounding|fixture_summary/,
    "manifest omits authored fields"
  );
}

expectFailure(
  [natalCore, { ...natalCore }],
  "KB_DRAFT_DUPLICATE_RECORD_ID",
  "duplicate record ID"
);
expectFailure(
  [{ ...natalCore, scopeTags: ["natal_core", "natal_core"] }],
  "KB_DRAFT_SCOPE_TAG_INVALID",
  "duplicate scope key"
);
expectFailure(
  [{ ...natalCore, language: "zh-Hans" }],
  "KB_DRAFT_LANGUAGE_INVALID",
  "malformed language"
);
expectFailure(
  [
    {
      ...natalCore,
      metadata: {
        ...natalCore.metadata,
        capabilityRequirements: ["birth_time_guessed"],
      },
    },
  ],
  "KB_DRAFT_METADATA_INVALID",
  "malformed capability"
);
expectFailure(
  [{ ...natalCore, metadata: undefined }],
  "KB_DRAFT_METADATA_INVALID",
  "missing metadata"
);
expectFailure(
  [{ ...natalCore, scopeTags: ["natal_core", "billing"] }],
  "KB_DRAFT_SCOPE_TAG_INVALID",
  "scope contamination"
);

for (const [label, contamination] of [
  ["Dice", { recordId: "dice_reference" }],
  ["Solar Return", { recordId: "solar_return_reference" }],
  ["transit", { recordId: "transit_reference" }],
  ["Vertex", { recordId: "vertex_reference" }],
  ["annual theme", { recordId: "annual_theme_reference" }],
  [
    "timing execution",
    {
      content: {
        ...natalCore.content,
        groundingInstruction: "timing execution fixture",
      },
    },
  ],
  [
    "provider credential",
    {
      metadata: {
        ...natalCore.metadata,
        sourceBasis: "provider credentials",
      },
    },
  ],
] as const) {
  expectFailure(
    [{ ...natalCore, ...contamination }],
    "KB_DRAFT_PROHIBITED_SCOPE",
    label
  );
}

expectFailure(
  [
    {
      ...natalCore,
      content: {
        ...natalCore.content,
        contentKind: "generated_interpretation",
      },
    },
  ],
  "KB_DRAFT_CONTENT_INVALID",
  "generated interpretation"
);

for (const [location, input] of [
  ["record email", { ...natalCore, email: "redacted" }],
  [
    "content birth data",
    {
      ...natalCore,
      content: { ...natalCore.content, birthDate: "redacted" },
    },
  ],
  [
    "metadata user identifier",
    {
      ...natalCore,
      metadata: { ...natalCore.metadata, userId: "redacted" },
    },
  ],
] as const) {
  const result = compileKnowledgeBankDraftManifest([input]);
  equal(result.ok, false, `${location} rejected`);
  doesNotMatch(
    JSON.stringify(result),
    /redacted|email|birthDate|userId/,
    `${location} failure is non-echoing`
  );
}

const repeatedA = compileKnowledgeBankDraftManifest([
  natalCore,
  natalDeep,
  timingFuture,
]);
const repeatedB = compileKnowledgeBankDraftManifest([
  timingFuture,
  natalDeep,
  natalCore,
]);
equal(
  JSON.stringify(repeatedA),
  JSON.stringify(repeatedB),
  "manifest is byte-stable across input order"
);

console.log("Knowledge Bank draft intake regression corpus passed");

function record(input: {
  recordId: string;
  scopeTags: string[];
  capabilityRequirements?: string[];
}) {
  return {
    schemaVersion: KNOWLEDGE_BANK_DRAFT_RECORD_VERSION,
    recordId: input.recordId,
    recordType: "planet",
    scopeTags: input.scopeTags,
    language: "en",
    content: {
      contentKind: "atomic_draft",
      name: "fixture_name",
      coreFunction: "fixture_core",
      keywords: ["fixture_keyword"],
      constructiveExpression: "fixture_constructive",
      challengingExpression: "fixture_challenging",
      groundingInstruction: "fixture_grounding",
      mobileSummary: "fixture_summary",
    },
    metadata: {
      sourceBasis: "canonical v0.2 development draft",
      reviewStatus: "not_reviewed",
      contentVersion: "kb_draft_0.2",
      capabilityRequirements: input.capabilityRequirements ?? [],
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
    equal(result.error.code, expectedCode, `${label} stable code`);
    equal(
      Object.keys(result.error).sort().join(","),
      "code,location,reason",
      `${label} non-echoing shape`
    );
  }
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: assertion failed`);
}

function doesNotMatch(value: string, pattern: RegExp, label: string): void {
  if (pattern.test(value)) throw new Error(`${label}: prohibited output`);
}
