export const CARE_CIRCLE_HEALTH_PROJECT_REF = "bmqhwofmdgebpcihjlnb";

export function classifyCareCircleHealthResponse(input) {
  if (!input || !["unauthenticated", "malformed"].includes(input.check)) {
    return stop("UNSAFE_RESPONSE");
  }
  if (!Number.isInteger(input.status)) return stop("UNSAFE_RESPONSE");
  if (input.status === 404) return stop("FUNCTION_UNAVAILABLE");
  if (typeof input.contentType !== "string" || !input.contentType.includes("application/json")) {
    return stop("UNSAFE_RESPONSE");
  }
  const error = parseClosedError(input.body);
  if (!error) return stop("UNSAFE_RESPONSE");

  if (input.check === "unauthenticated") {
    return input.status === 401 && error.code === "AUTH_REQUIRED"
      ? pass("unauthenticated_rejection")
      : stop("AUTH_DENIAL_UNCONFIRMED");
  }
  return input.status === 409 && error.code === "48012"
    ? pass("malformed_request_rejection")
    : stop("MALFORMED_REJECTION_UNCONFIRMED");
}

export function classifyCareCircleHealthFailure(kind) {
  return kind === "network"
    ? stop("NETWORK_ERROR")
    : stop("UNKNOWN_FAILURE");
}

function parseClosedError(body) {
  if (typeof body !== "string" || body.length === 0 || body.length > 4096) return null;
  try {
    const parsed = JSON.parse(body);
    if (!isRecord(parsed) || Object.keys(parsed).join(",") !== "error") return null;
    if (!isRecord(parsed.error)) return null;
    const keys = Object.keys(parsed.error).sort().join(",");
    if (keys !== "code,message") return null;
    return typeof parsed.error.code === "string" && typeof parsed.error.message === "string"
      ? { code: parsed.error.code }
      : null;
  } catch {
    return null;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pass(check) {
  return { ok: true, check, code: "PASS" };
}

function stop(code) {
  return { ok: false, check: "health", code: `STOP_S2_T104_${code}` };
}
