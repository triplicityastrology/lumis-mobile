export const INACTIVE_CARE_CIRCLE_CLIENT_VERSION =
  "inactive_care_circle_client_v1" as const;

export type CareCircleClientAction =
  | "create_pairing_code"
  | "rotate_pairing_code"
  | "submit_pairing_code"
  | "accept_relationship"
  | "decline_relationship"
  | "pause_care"
  | "resume_care"
  | "remove_relationship";

export type CareCircleClientInput =
  | {
      action: "create_pairing_code" | "rotate_pairing_code";
      clientRequestId: string;
    }
  | {
      action: "submit_pairing_code";
      clientRequestId: string;
      pairingCode: string;
    }
  | {
      action:
        | "accept_relationship"
        | "decline_relationship"
        | "remove_relationship";
      clientRequestId: string;
      relationshipId: string;
    }
  | {
      action: "pause_care";
      clientRequestId: string;
      pausedUntil: string;
    }
  | {
      action: "resume_care";
      clientRequestId: string;
    };

export type CareCircleEdgeRequest = {
  action:
    | "pairing_code_create"
    | "pairing_code_submit"
    | "relationship_accept"
    | "relationship_decline"
    | "care_pause"
    | "care_resume"
    | "relationship_remove";
  client_request_id: string;
  pairing_code?: string;
  relationship_id?: string;
  paused_until?: string;
};

export type CareCircleClientPort = {
  execute(request: CareCircleEdgeRequest): Promise<unknown>;
};

export type CareCircleClientFailureCode =
  | "CARE_CIRCLE_INPUT_INVALID"
  | "CARE_CIRCLE_AUTH_REQUIRED"
  | "CARE_CIRCLE_PAIRING_CODE_INVALID"
  | "CARE_CIRCLE_RELATIONSHIP_EXISTS"
  | "CARE_CIRCLE_SELF_LINK_FORBIDDEN"
  | "CARE_CIRCLE_RELATIONSHIP_UNAVAILABLE"
  | "CARE_CIRCLE_RELATIONSHIP_ENDED"
  | "CARE_CIRCLE_REQUEST_CONFLICT"
  | "CARE_CIRCLE_CARER_PROFILE_REQUIRED"
  | "CARE_CIRCLE_UNAVAILABLE";

type CommonSuccess = {
  ok: true;
  clientVersion: typeof INACTIVE_CARE_CIRCLE_CLIENT_VERSION;
  replayed: boolean;
};

export type CareCircleClientSuccess =
  | (CommonSuccess & {
      code: "CARE_CIRCLE_PAIRING_CODE_READY";
      pairingCode: string;
      codeId: string;
      expiresAt: string;
    })
  | (CommonSuccess & {
      code: "CARE_CIRCLE_PENDING_CAREE_ACCEPTANCE";
      relationshipId: string;
      relationshipStatus: "pending_caree_acceptance";
    })
  | (CommonSuccess & {
      code:
        | "CARE_CIRCLE_RELATIONSHIP_ACCEPTED"
        | "CARE_CIRCLE_RELATIONSHIP_DECLINED"
        | "CARE_CIRCLE_RELATIONSHIP_REMOVED";
      relationshipId: string;
    })
  | (CommonSuccess & {
      code: "CARE_CIRCLE_PAUSED";
      pausedUntil: string;
    })
  | (CommonSuccess & {
      code: "CARE_CIRCLE_RESUMED";
    });

export type CareCircleClientFailure = {
  ok: false;
  clientVersion: typeof INACTIVE_CARE_CIRCLE_CLIENT_VERSION;
  code: CareCircleClientFailureCode;
  message: string;
  retryable: boolean;
};

export type CareCircleClientResult =
  | CareCircleClientSuccess
  | CareCircleClientFailure;

export type InactiveCareCircleClient = {
  readonly version: typeof INACTIVE_CARE_CIRCLE_CLIENT_VERSION;
  execute(input: CareCircleClientInput): Promise<CareCircleClientResult>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAIRING_CODE_PATTERN = /^\d{4}$/;

const FAILURE_MESSAGES: Record<CareCircleClientFailureCode, string> = {
  CARE_CIRCLE_INPUT_INVALID: "Check the Care Circle request and try again.",
  CARE_CIRCLE_AUTH_REQUIRED: "Sign in to continue with Care Circle.",
  CARE_CIRCLE_PAIRING_CODE_INVALID:
    "This pairing code is no longer available. Ask the Caree to refresh it.",
  CARE_CIRCLE_RELATIONSHIP_EXISTS:
    "This Care Circle relationship already exists.",
  CARE_CIRCLE_SELF_LINK_FORBIDDEN:
    "The same account cannot be both participants in this Care Circle.",
  CARE_CIRCLE_RELATIONSHIP_UNAVAILABLE:
    "This Care Circle relationship is not available.",
  CARE_CIRCLE_RELATIONSHIP_ENDED:
    "This Care Circle relationship has ended.",
  CARE_CIRCLE_REQUEST_CONFLICT:
    "This Care Circle request cannot be completed.",
  CARE_CIRCLE_CARER_PROFILE_REQUIRED:
    "Finish the Lumis Carer profile before continuing.",
  CARE_CIRCLE_UNAVAILABLE:
    "Care Circle could not complete this request. Try again later.",
};

export function createInactiveCareCircleClient(
  port: CareCircleClientPort
): InactiveCareCircleClient {
  return {
    version: INACTIVE_CARE_CIRCLE_CLIENT_VERSION,
    async execute(
      input: CareCircleClientInput
    ): Promise<CareCircleClientResult> {
      const request = buildRequest(input);
      if (!request) return failure("CARE_CIRCLE_INPUT_INVALID", false);

      try {
        return projectResponse(input.action, await port.execute(request));
      } catch {
        return failure("CARE_CIRCLE_UNAVAILABLE", true);
      }
    },
  };
}

function buildRequest(
  input: CareCircleClientInput
): CareCircleEdgeRequest | null {
  if (!UUID_PATTERN.test(input.clientRequestId)) return null;

  switch (input.action) {
    case "create_pairing_code":
    case "rotate_pairing_code":
      return {
        action: "pairing_code_create",
        client_request_id: input.clientRequestId,
      };
    case "submit_pairing_code":
      if (!PAIRING_CODE_PATTERN.test(input.pairingCode.trim())) return null;
      return {
        action: "pairing_code_submit",
        client_request_id: input.clientRequestId,
        pairing_code: input.pairingCode.trim(),
      };
    case "accept_relationship":
    case "decline_relationship":
    case "remove_relationship":
      if (!UUID_PATTERN.test(input.relationshipId)) return null;
      const edgeActions = {
        accept_relationship: "relationship_accept",
        decline_relationship: "relationship_decline",
        remove_relationship: "relationship_remove",
      } as const;
      return {
        action: edgeActions[input.action],
        client_request_id: input.clientRequestId,
        relationship_id: input.relationshipId,
      };
    case "pause_care": {
      const pausedUntil = Date.parse(input.pausedUntil);
      if (!Number.isFinite(pausedUntil)) return null;
      return {
        action: "care_pause",
        client_request_id: input.clientRequestId,
        paused_until: new Date(pausedUntil).toISOString(),
      };
    }
    case "resume_care":
      return {
        action: "care_resume",
        client_request_id: input.clientRequestId,
      };
  }
}

function projectResponse(
  action: CareCircleClientAction,
  response: unknown
): CareCircleClientResult {
  if (!isRecord(response)) return failure("CARE_CIRCLE_UNAVAILABLE", true);

  const backendError = isRecord(response.error) ? response.error : null;
  if (backendError) {
    return mapFailure(
      typeof backendError.code === "string" ? backendError.code : null
    );
  }
  if (response.ok !== true) return failure("CARE_CIRCLE_UNAVAILABLE", true);

  const common: CommonSuccess = {
    ok: true,
    clientVersion: INACTIVE_CARE_CIRCLE_CLIENT_VERSION,
    replayed: response.idempotent === true,
  };

  if (
    action === "create_pairing_code" ||
    action === "rotate_pairing_code"
  ) {
    if (
      typeof response.pairing_code !== "string" ||
      !PAIRING_CODE_PATTERN.test(response.pairing_code) ||
      !UUID_PATTERN.test(asString(response.code_id)) ||
      !isTimestamp(response.expires_at)
    ) {
      return failure("CARE_CIRCLE_UNAVAILABLE", true);
    }
    return {
      ...common,
      code: "CARE_CIRCLE_PAIRING_CODE_READY",
      pairingCode: response.pairing_code,
      codeId: asString(response.code_id),
      expiresAt: response.expires_at,
    };
  }

  if (action === "submit_pairing_code") {
    if (
      response.status !== "pending_caree_acceptance" ||
      !UUID_PATTERN.test(asString(response.relationship_id))
    ) {
      return failure("CARE_CIRCLE_UNAVAILABLE", true);
    }
    return {
      ...common,
      code: "CARE_CIRCLE_PENDING_CAREE_ACCEPTANCE",
      relationshipId: asString(response.relationship_id),
      relationshipStatus: "pending_caree_acceptance",
    };
  }

  if (
    action === "accept_relationship" ||
    action === "decline_relationship" ||
    action === "remove_relationship"
  ) {
    if (!UUID_PATTERN.test(asString(response.relationship_id))) {
      return failure("CARE_CIRCLE_UNAVAILABLE", true);
    }
    const successCodes = {
      accept_relationship: "CARE_CIRCLE_RELATIONSHIP_ACCEPTED",
      decline_relationship: "CARE_CIRCLE_RELATIONSHIP_DECLINED",
      remove_relationship: "CARE_CIRCLE_RELATIONSHIP_REMOVED",
    } as const;
    return {
      ...common,
      code: successCodes[action],
      relationshipId: asString(response.relationship_id),
    };
  }

  if (action === "pause_care") {
    if (!isTimestamp(response.paused_until)) {
      return failure("CARE_CIRCLE_UNAVAILABLE", true);
    }
    return {
      ...common,
      code: "CARE_CIRCLE_PAUSED",
      pausedUntil: response.paused_until,
    };
  }

  return { ...common, code: "CARE_CIRCLE_RESUMED" };
}

function mapFailure(backendCode: string | null): CareCircleClientFailure {
  switch (backendCode) {
    case "AUTH_REQUIRED":
      return failure("CARE_CIRCLE_AUTH_REQUIRED", false);
    case "48004":
      return failure("CARE_CIRCLE_PAIRING_CODE_INVALID", false);
    case "48005":
      return failure("CARE_CIRCLE_RELATIONSHIP_EXISTS", false);
    case "48006":
      return failure("CARE_CIRCLE_SELF_LINK_FORBIDDEN", false);
    case "48007":
      return failure("CARE_CIRCLE_RELATIONSHIP_UNAVAILABLE", false);
    case "48009":
      return failure("CARE_CIRCLE_RELATIONSHIP_ENDED", false);
    case "48012":
      return failure("CARE_CIRCLE_REQUEST_CONFLICT", false);
    case "48013":
      return failure("CARE_CIRCLE_CARER_PROFILE_REQUIRED", false);
    default:
      return failure("CARE_CIRCLE_UNAVAILABLE", true);
  }
}

function failure(
  code: CareCircleClientFailureCode,
  retryable: boolean
): CareCircleClientFailure {
  return {
    ok: false,
    clientVersion: INACTIVE_CARE_CIRCLE_CLIENT_VERSION,
    code,
    message: FAILURE_MESSAGES[code],
    retryable,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
