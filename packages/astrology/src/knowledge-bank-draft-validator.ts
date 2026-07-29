export const KNOWLEDGE_BANK_DRAFT_RECORD_VERSION =
  "knowledge_bank_draft_record_v0_2" as const;
export const KNOWLEDGE_BANK_DRAFT_MANIFEST_VERSION =
  "knowledge_bank_draft_manifest_v0_2" as const;

export const KNOWLEDGE_BANK_DRAFT_RECORD_TYPES = [
  "planet",
  "sign",
  "element_modality",
  "house",
  "aspect",
  "chart_pattern",
  "house_status",
  "question_route",
] as const;
export const KNOWLEDGE_BANK_DRAFT_SCOPE_TAGS = [
  "natal_core",
  "natal_deep",
  "timing_future",
] as const;
export const KNOWLEDGE_BANK_DRAFT_LANGUAGES = ["en", "zh-Hant"] as const;
export const KNOWLEDGE_BANK_DRAFT_REVIEW_STATUSES = [
  "not_reviewed",
  "approved",
  "revise",
  "remove",
] as const;
export const KNOWLEDGE_BANK_DRAFT_CAPABILITIES = [
  "birth_time_supplied",
  "houses_available",
  "angles_available",
  "moon_sign_available",
] as const;

export type KnowledgeBankDraftFailureCode =
  | "KB_DRAFT_INPUT_NOT_ARRAY"
  | "KB_DRAFT_RECORD_NOT_OBJECT"
  | "KB_DRAFT_UNKNOWN_FIELD"
  | "KB_DRAFT_SCHEMA_UNSUPPORTED"
  | "KB_DRAFT_RECORD_ID_INVALID"
  | "KB_DRAFT_DUPLICATE_RECORD_ID"
  | "KB_DRAFT_RECORD_TYPE_INVALID"
  | "KB_DRAFT_SCOPE_TAGS_INVALID"
  | "KB_DRAFT_SCOPE_TAG_INVALID"
  | "KB_DRAFT_LANGUAGE_INVALID"
  | "KB_DRAFT_CONTENT_INVALID"
  | "KB_DRAFT_METADATA_INVALID"
  | "KB_DRAFT_PROHIBITED_SCOPE";

export type KnowledgeBankDraftFailure = {
  code: KnowledgeBankDraftFailureCode;
  reason:
    | "record_list_required"
    | "record_object_required"
    | "closed_schema_required"
    | "supported_schema_required"
    | "stable_record_id_required"
    | "record_id_must_be_unique"
    | "allowed_record_type_required"
    | "scope_tag_list_required"
    | "allowed_scope_tag_required"
    | "supported_language_required"
    | "atomic_draft_content_required"
    | "required_metadata_invalid"
    | "prohibited_scope_or_execution_reference";
  location:
    | "root"
    | "record"
    | "record_id"
    | "record_type"
    | "scope_tags"
    | "language"
    | "content"
    | "metadata";
};

export type KnowledgeBankDraftManifest = {
  schemaVersion: typeof KNOWLEDGE_BANK_DRAFT_MANIFEST_VERSION;
  sourceSchemaVersion: typeof KNOWLEDGE_BANK_DRAFT_RECORD_VERSION;
  recordCount: number;
  records: Array<{
    recordId: string;
    recordType: (typeof KNOWLEDGE_BANK_DRAFT_RECORD_TYPES)[number];
    scopeTags: Array<(typeof KNOWLEDGE_BANK_DRAFT_SCOPE_TAGS)[number]>;
    language: (typeof KNOWLEDGE_BANK_DRAFT_LANGUAGES)[number];
    reviewStatus: (typeof KNOWLEDGE_BANK_DRAFT_REVIEW_STATUSES)[number];
    contentVersion: string;
    capabilityRequirements: Array<
      (typeof KNOWLEDGE_BANK_DRAFT_CAPABILITIES)[number]
    >;
  }>;
};

export type KnowledgeBankDraftValidationResult =
  | { ok: true; value: KnowledgeBankDraftManifest }
  | { ok: false; error: KnowledgeBankDraftFailure };

const ROOT_FIELDS = new Set([
  "schemaVersion",
  "recordId",
  "recordType",
  "scopeTags",
  "language",
  "content",
  "metadata",
]);
const CONTENT_FIELDS = new Set([
  "contentKind",
  "name",
  "coreFunction",
  "keywords",
  "constructiveExpression",
  "challengingExpression",
  "groundingInstruction",
  "mobileSummary",
]);
const METADATA_FIELDS = new Set([
  "sourceBasis",
  "reviewStatus",
  "contentVersion",
  "capabilityRequirements",
  "sourceRuleVersion",
]);
const RECORD_ID = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const CONTENT_VERSION = /^kb_draft_[0-9]+(?:\.[0-9]+){1,2}$/;
const SOURCE_RULE_VERSION = /^[a-z0-9]+(?:_[a-z0-9]+)*_v[0-9]+$/;
const PROHIBITED_REFERENCE =
  /\b(?:dice|solar\s+return|transit|vertex|annual\s+theme|provider\s+(?:config(?:uration)?|credentials?)|api\s+keys?|generated\s+interpretation)\b/i;
const TIMING_EXECUTION_REFERENCE =
  /\b(?:timing\s+(?:execute|execution|calculation|ranking|window|date)|date\s+ranking)\b/i;

export function compileKnowledgeBankDraftManifest(
  input: unknown
): KnowledgeBankDraftValidationResult {
  if (!Array.isArray(input)) {
    return failure(
      "KB_DRAFT_INPUT_NOT_ARRAY",
      "record_list_required",
      "root"
    );
  }

  const seenIds = new Set<string>();
  const records: KnowledgeBankDraftManifest["records"] = [];

  for (const candidate of input) {
    if (!isRecord(candidate)) {
      return failure(
        "KB_DRAFT_RECORD_NOT_OBJECT",
        "record_object_required",
        "record"
      );
    }
    if (!hasOnlyFields(candidate, ROOT_FIELDS)) {
      return failure(
        "KB_DRAFT_UNKNOWN_FIELD",
        "closed_schema_required",
        "record"
      );
    }
    if (candidate.schemaVersion !== KNOWLEDGE_BANK_DRAFT_RECORD_VERSION) {
      return failure(
        "KB_DRAFT_SCHEMA_UNSUPPORTED",
        "supported_schema_required",
        "record"
      );
    }
    if (
      typeof candidate.recordId !== "string" ||
      !RECORD_ID.test(candidate.recordId) ||
      candidate.recordId.length > 96
    ) {
      return failure(
        "KB_DRAFT_RECORD_ID_INVALID",
        "stable_record_id_required",
        "record_id"
      );
    }
    if (seenIds.has(candidate.recordId)) {
      return failure(
        "KB_DRAFT_DUPLICATE_RECORD_ID",
        "record_id_must_be_unique",
        "record_id"
      );
    }
    if (!isAllowed(candidate.recordType, KNOWLEDGE_BANK_DRAFT_RECORD_TYPES)) {
      return failure(
        "KB_DRAFT_RECORD_TYPE_INVALID",
        "allowed_record_type_required",
        "record_type"
      );
    }
    const scopeTags = validateStringSet(
      candidate.scopeTags,
      KNOWLEDGE_BANK_DRAFT_SCOPE_TAGS
    );
    if (scopeTags === "not_array") {
      return failure(
        "KB_DRAFT_SCOPE_TAGS_INVALID",
        "scope_tag_list_required",
        "scope_tags"
      );
    }
    if (scopeTags === "invalid") {
      return failure(
        "KB_DRAFT_SCOPE_TAG_INVALID",
        "allowed_scope_tag_required",
        "scope_tags"
      );
    }
    if (!isAllowed(candidate.language, KNOWLEDGE_BANK_DRAFT_LANGUAGES)) {
      return failure(
        "KB_DRAFT_LANGUAGE_INVALID",
        "supported_language_required",
        "language"
      );
    }
    if (!validContent(candidate.content)) {
      return failure(
        "KB_DRAFT_CONTENT_INVALID",
        "atomic_draft_content_required",
        "content"
      );
    }
    const metadata = validateMetadata(candidate.metadata);
    if (!metadata) {
      return failure(
        "KB_DRAFT_METADATA_INVALID",
        "required_metadata_invalid",
        "metadata"
      );
    }
    if (
      containsProhibitedReference(candidate.recordId) ||
      containsProhibitedReference(candidate.content) ||
      containsProhibitedReference(candidate.metadata)
    ) {
      return failure(
        "KB_DRAFT_PROHIBITED_SCOPE",
        "prohibited_scope_or_execution_reference",
        "record"
      );
    }

    seenIds.add(candidate.recordId);
    records.push({
      recordId: candidate.recordId,
      recordType: candidate.recordType,
      scopeTags: [...scopeTags].sort(),
      language: candidate.language,
      reviewStatus: metadata.reviewStatus,
      contentVersion: metadata.contentVersion,
      capabilityRequirements: [...metadata.capabilityRequirements].sort(),
    });
  }

  records.sort((left, right) => left.recordId.localeCompare(right.recordId));
  return {
    ok: true,
    value: {
      schemaVersion: KNOWLEDGE_BANK_DRAFT_MANIFEST_VERSION,
      sourceSchemaVersion: KNOWLEDGE_BANK_DRAFT_RECORD_VERSION,
      recordCount: records.length,
      records,
    },
  };
}

function validContent(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyFields(value, CONTENT_FIELDS)) {
    return false;
  }
  if (value.contentKind !== "atomic_draft") {
    return false;
  }
  for (const required of [
    "name",
    "coreFunction",
    "constructiveExpression",
    "challengingExpression",
    "groundingInstruction",
    "mobileSummary",
  ]) {
    if (!nonEmptyBoundedString(value[required], 1_000)) {
      return false;
    }
  }
  return (
    Array.isArray(value.keywords) &&
    value.keywords.length >= 1 &&
    value.keywords.length <= 12 &&
    value.keywords.every((keyword) => nonEmptyBoundedString(keyword, 80))
  );
}

function validateMetadata(value: unknown): {
  reviewStatus: (typeof KNOWLEDGE_BANK_DRAFT_REVIEW_STATUSES)[number];
  contentVersion: string;
  capabilityRequirements: Array<
    (typeof KNOWLEDGE_BANK_DRAFT_CAPABILITIES)[number]
  >;
} | null {
  if (!isRecord(value) || !hasOnlyFields(value, METADATA_FIELDS)) {
    return null;
  }
  if (
    !nonEmptyBoundedString(value.sourceBasis, 300) ||
    !isAllowed(value.reviewStatus, KNOWLEDGE_BANK_DRAFT_REVIEW_STATUSES) ||
    typeof value.contentVersion !== "string" ||
    !CONTENT_VERSION.test(value.contentVersion)
  ) {
    return null;
  }
  const capabilities = validateStringSet(
    value.capabilityRequirements,
    KNOWLEDGE_BANK_DRAFT_CAPABILITIES,
    true
  );
  if (capabilities === "not_array" || capabilities === "invalid") {
    return null;
  }
  if (
    value.sourceRuleVersion !== undefined &&
    (typeof value.sourceRuleVersion !== "string" ||
      !SOURCE_RULE_VERSION.test(value.sourceRuleVersion))
  ) {
    return null;
  }
  return {
    reviewStatus: value.reviewStatus,
    contentVersion: value.contentVersion,
    capabilityRequirements: capabilities,
  };
}

function containsProhibitedReference(value: unknown): boolean {
  if (typeof value === "string") {
    if (value === "timing_future") {
      return false;
    }
    const normalized = value.replace(/[^a-z0-9]+/gi, " ");
    return (
      PROHIBITED_REFERENCE.test(normalized) ||
      TIMING_EXECUTION_REFERENCE.test(normalized)
    );
  }
  if (Array.isArray(value)) {
    return value.some(containsProhibitedReference);
  }
  if (isRecord(value)) {
    return Object.values(value).some(containsProhibitedReference);
  }
  return false;
}

function validateStringSet<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  allowEmpty = false
): Array<T[number]> | "not_array" | "invalid" {
  if (!Array.isArray(value)) {
    return "not_array";
  }
  if (
    (!allowEmpty && value.length === 0) ||
    new Set(value).size !== value.length ||
    !value.every((item) => isAllowed(item, allowed))
  ) {
    return "invalid";
  }
  return value as Array<T[number]>;
}

function isAllowed<const T extends readonly string[]>(
  value: unknown,
  allowed: T
): value is T[number] {
  return typeof value === "string" && allowed.includes(value);
}

function nonEmptyBoundedString(value: unknown, maxLength: number): boolean {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function hasOnlyFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>
): boolean {
  return Object.keys(value).every((field) => allowed.has(field));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function failure(
  code: KnowledgeBankDraftFailureCode,
  reason: KnowledgeBankDraftFailure["reason"],
  location: KnowledgeBankDraftFailure["location"]
): KnowledgeBankDraftValidationResult {
  return { ok: false, error: { code, reason, location } };
}
