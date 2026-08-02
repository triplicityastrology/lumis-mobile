import {
  type CareCircleAction,
  type CareCircleRequest,
  projectSafeCareCircleResponse,
  validateCareCircleRequest,
} from "./operation-boundary.ts";

type AuthPort = { actorForAuthorization(value: string | null): Promise<string | null> };
type RpcResult = { data?: unknown; errorCode?: string };
type RpcPort = { call(name: string, params: Record<string, unknown>): Promise<RpcResult> };

export type LocalEdgePorts = { auth: AuthPort; rpc: RpcPort; pairingCodeForCreate(): string };

export async function runLocalCareCircleRequest(
  authorization: string | null,
  input: unknown,
  ports: LocalEdgePorts,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const actorUserId = await ports.auth.actorForAuthorization(authorization);
  if (!actorUserId) return failure(401, "AUTH_REQUIRED", "Sign in is required.");
  const validation = validateCareCircleRequest(input);
  if (!validation.ok) return failure(validation.status, validation.code, validation.message);
  const request = validation.body;

  if (request.action === "pairing_code_submit") {
    const attempt = await ports.rpc.call("register_care_pairing_attempt_backend", { p_actor_user_id: actorUserId });
    if (attempt.errorCode || !isAllowed(attempt.data)) return failure(410, "48004", "This pairing code is not valid or has expired.");
  }
  const rpc = rpcFor(request.action!);
  const response = await ports.rpc.call(rpc, {
    p_actor_user_id: actorUserId,
    p_request_id: request.client_request_id,
  });
  if (response.errorCode) return mappedFailure(response.errorCode);

  try {
    const pairingCode = request.action === "pairing_code_create" ? ports.pairingCodeForCreate() : undefined;
    return { status: 200, body: projectSafeCareCircleResponse(request.action!, response.data, pairingCode) };
  } catch {
    return failure(503, "CARE_CIRCLE_OPERATION_FAILED", "Care Circle could not complete this request.");
  }
}

function rpcFor(action: CareCircleAction): string {
  const map: Record<CareCircleAction, string> = {
    pairing_code_create: "create_care_pairing_code_backend",
    pairing_code_revoke: "revoke_care_pairing_code_backend",
    pairing_code_submit: "consume_care_pairing_code_backend",
    relationship_accept: "accept_care_relationship_backend",
    relationship_decline: "decline_care_relationship_backend",
    care_pause: "update_care_pause_backend",
    care_resume: "update_care_pause_backend",
    relationship_remove: "remove_care_relationship_backend",
  };
  return map[action];
}

function isAllowed(value: unknown): boolean {
  return typeof value === "object" && value !== null && (value as { allowed?: unknown }).allowed === true;
}

function mappedFailure(code: string) {
  const safe: Record<string, [number, string]> = {
    "48004": [410, "This pairing code is not valid or has expired."],
    "48005": [409, "This Care Circle relationship already exists."],
    "48006": [400, "You cannot add yourself as a Carer."],
    "48007": [404, "This Care Circle relationship is not available."],
    "48009": [410, "This Care Circle relationship has ended."],
    "48012": [409, "This Care Circle request can no longer be completed."],
    "48013": [428, "Finish your Lumis Carer profile to continue."],
  };
  const mapped = safe[code];
  return mapped ? failure(mapped[0], code, mapped[1]) : failure(503, "CARE_CIRCLE_OPERATION_FAILED", "Care Circle could not complete this request.");
}

function failure(status: number, code: string, message: string) {
  return { status, body: { error: { code, message } } };
}
