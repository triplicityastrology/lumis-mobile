export type CareCircleAction =
  | "pairing_code_create"
  | "pairing_code_revoke"
  | "pairing_code_submit"
  | "relationship_accept"
  | "relationship_decline"
  | "care_pause"
  | "care_resume"
  | "relationship_remove";

export type CareCircleRequest = {
  action?: CareCircleAction;
  client_request_id?: string;
  pairing_code?: string;
  code_id?: string;
  relationship_id?: string;
  paused_until?: string;
};

export type ValidationFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PAIRING_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

const ACTIONS: CareCircleAction[] = [
  "pairing_code_create",
  "pairing_code_revoke",
  "pairing_code_submit",
  "relationship_accept",
  "relationship_decline",
  "care_pause",
  "care_resume",
  "relationship_remove"
];

const COMMON_KEYS = ["action", "client_request_id"] as const;
const ACTION_KEYS: Record<CareCircleAction, readonly string[]> = {
  pairing_code_create: COMMON_KEYS,
  pairing_code_revoke: [...COMMON_KEYS, "code_id"],
  pairing_code_submit: [...COMMON_KEYS, "pairing_code"],
  relationship_accept: [...COMMON_KEYS, "relationship_id"],
  relationship_decline: [...COMMON_KEYS, "relationship_id"],
  care_pause: [...COMMON_KEYS, "paused_until"],
  care_resume: COMMON_KEYS,
  relationship_remove: [...COMMON_KEYS, "relationship_id"]
};

const SAFE_STATUSES: Record<CareCircleAction, readonly string[]> = {
  pairing_code_create: ["active"],
  pairing_code_revoke: ["revoked"],
  pairing_code_submit: ["pending_caree_acceptance"],
  relationship_accept: ["active"],
  relationship_decline: ["declined"],
  care_pause: ["paused"],
  care_resume: ["active"],
  relationship_remove: ["removed_by_caree", "removed_by_carer", "declined", "expired"]
};

export function validateCareCircleRequest(body: unknown):
  | { ok: true; body: CareCircleRequest }
  | ValidationFailure {
  if (!isRecord(body) || !ACTIONS.includes(body.action as CareCircleAction)) {
    return invalidOperation();
  }

  const action = body.action as CareCircleAction;
  const allowedKeys = ACTION_KEYS[action];
  if (Object.keys(body).some((key) => !allowedKeys.includes(key))) {
    return invalidOperation();
  }

  if (!UUID_PATTERN.test(safeString(body.client_request_id))) {
    return invalidOperation();
  }

  if (
    action === "pairing_code_revoke"
    && !UUID_PATTERN.test(safeString(body.code_id))
  ) {
    return invalidPairingCode();
  }

  if (action === "pairing_code_submit" && !normalizePairingCode(body.pairing_code)) {
    return invalidPairingCode();
  }

  if (
    ["relationship_accept", "relationship_decline", "relationship_remove"].includes(action)
    && !UUID_PATTERN.test(safeString(body.relationship_id))
  ) {
    return unavailableRelationship();
  }

  if (action === "care_pause") {
    const pausedUntil = typeof body.paused_until === "string"
      ? Date.parse(body.paused_until)
      : Number.NaN;
    if (!Number.isFinite(pausedUntil) || pausedUntil <= Date.now()) {
      return invalidOperation();
    }
  }

  return { ok: true, body: body as CareCircleRequest };
}

export function projectSafeCareCircleResponse(
  action: CareCircleAction,
  data: unknown,
  pairingCode?: string
): Record<string, unknown> {
  if (!isRecord(data) || data.ok !== true || data.idempotent === undefined) {
    throw new Error("CARE_CIRCLE_UNSAFE_BACKEND_RESPONSE");
  }

  const status = safeString(data.status);
  if (!SAFE_STATUSES[action].includes(status)) {
    throw new Error("CARE_CIRCLE_UNSAFE_BACKEND_RESPONSE");
  }

  const response: Record<string, unknown> = {
    ok: true,
    status,
    idempotent: data.idempotent === true
  };

  if (action === "pairing_code_create" || action === "pairing_code_revoke") {
    requireUuid(data.code_id);
    response.code_id = data.code_id;
  }
  if (
    action === "pairing_code_submit"
    || action === "relationship_accept"
    || action === "relationship_decline"
    || action === "relationship_remove"
  ) {
    requireUuid(data.relationship_id);
    response.relationship_id = data.relationship_id;
  }
  if (action === "pairing_code_create") {
    requireTimestamp(data.expires_at);
    if (!normalizePairingCode(pairingCode)) {
      throw new Error("CARE_CIRCLE_UNSAFE_BACKEND_RESPONSE");
    }
    response.expires_at = data.expires_at;
    response.pairing_code = pairingCode;
  }
  if (action === "care_pause") {
    requireTimestamp(data.paused_until);
    response.paused_until = data.paused_until;
  }

  return response;
}

export function normalizePairingCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.toUpperCase().replace(/[-\s]/g, "");
  if (
    normalized.length !== 12
    || [...normalized].some((character) => !PAIRING_CODE_ALPHABET.includes(character))
  ) {
    return null;
  }
  return normalized;
}

function requireUuid(value: unknown): asserts value is string {
  if (!UUID_PATTERN.test(safeString(value))) {
    throw new Error("CARE_CIRCLE_UNSAFE_BACKEND_RESPONSE");
  }
}

function requireTimestamp(value: unknown): asserts value is string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("CARE_CIRCLE_UNSAFE_BACKEND_RESPONSE");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function invalidPairingCode(): ValidationFailure {
  return {
    ok: false,
    status: 410,
    code: "48004",
    message: "This pairing code is not valid. Ask the Caree to refresh it."
  };
}

function unavailableRelationship(): ValidationFailure {
  return {
    ok: false,
    status: 404,
    code: "48007",
    message: "This Care Circle relationship is not available."
  };
}

function invalidOperation(): ValidationFailure {
  return {
    ok: false,
    status: 409,
    code: "48012",
    message: "This Care Circle request can no longer be completed."
  };
}
