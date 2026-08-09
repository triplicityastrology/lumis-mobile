import { createHash } from "node:crypto";

const SHA40 = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const SESSION_KEYS = [
  "schema", "session_id", "source_sha", "metro_bundle_sha256", "route_prefix",
  "port", "device_udid", "created_at", "expected_states"
];
const CAPTURE_KEYS = [
  "schema", "session_id", "source_sha", "metro_bundle_sha256", "state", "fixture",
  "route", "file", "image_sha256", "ocr_sha256", "width", "height", "captured_at",
  "build_marker_verified", "state_marker_verified", "product_evidence_verified",
  "forbidden_frame_detected", "provider_calls", "units_consumed", "persistence_writes",
  "remote_history_reads", "remote_history_deletes", "live_ai_proof", "human_verdict"
];

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function validateSessionReceipt(receipt, control, sourceSha) {
  exactKeys(receipt, SESSION_KEYS, "SESSION_FIELDS");
  if (receipt.schema !== "s2_t246_dice_capture_session_v1") stop("SESSION_SCHEMA");
  if (!SHA40.test(receipt.source_sha) || receipt.source_sha !== sourceSha) stop("SESSION_SOURCE");
  if (!SHA256.test(receipt.metro_bundle_sha256)) stop("SESSION_BUNDLE_HASH");
  if (!SHA256.test(receipt.session_id)) stop("SESSION_ID");
  if (receipt.route_prefix !== control.route_prefix) stop("SESSION_ROUTE");
  if (receipt.port !== control.simulator_port) stop("SESSION_PORT");
  if (receipt.device_udid !== control.device_udid) stop("SESSION_DEVICE");
  if (!isTimestamp(receipt.created_at)) stop("SESSION_TIMESTAMP");
  const states = control.states.map(({ id }) => id);
  if (JSON.stringify(receipt.expected_states) !== JSON.stringify(states)) stop("SESSION_STATES");
  return receipt;
}

export function validateCaptureReceipt(receipt, context) {
  const { control, session, imageBytes, ocrText, width, height } = context;
  exactKeys(receipt, CAPTURE_KEYS, "CAPTURE_FIELDS");
  const stateControl = control.states.find(({ id }) => id === receipt.state);
  if (!stateControl || receipt.fixture !== stateControl.fixture) stop("CAPTURE_STATE");
  if (receipt.schema !== "s2_t246_dice_capture_receipt_v1") stop("CAPTURE_SCHEMA");
  if (receipt.session_id !== session.session_id || receipt.source_sha !== session.source_sha) stop("CAPTURE_SESSION");
  if (receipt.metro_bundle_sha256 !== session.metro_bundle_sha256) stop("CAPTURE_BUNDLE");
  if (receipt.route !== `${control.route_prefix}?state=${receipt.state}`) stop("CAPTURE_ROUTE");
  if (receipt.file !== `captures/${receipt.state}.png`) stop("CAPTURE_FILE");
  if (receipt.image_sha256 !== sha256(imageBytes)) stop("CAPTURE_IMAGE_HASH");
  if (receipt.ocr_sha256 !== sha256(ocrText)) stop("CAPTURE_OCR_HASH");
  if (receipt.width !== width || receipt.height !== height) stop("CAPTURE_DIMENSIONS_RECEIPT");
  if (width !== control.expected_dimensions.width || height !== control.expected_dimensions.height) stop("CAPTURE_DIMENSIONS");
  if (!isTimestamp(receipt.captured_at)) stop("CAPTURE_TIMESTAMP");
  if (receipt.build_marker_verified !== true || receipt.state_marker_verified !== true || receipt.product_evidence_verified !== true) stop("CAPTURE_VISIBLE_EVIDENCE");
  if (receipt.forbidden_frame_detected !== false) stop("CAPTURE_FORBIDDEN_FRAME");
  for (const [key, expected] of Object.entries(control.effects)) {
    if (receipt[key] !== expected) stop("CAPTURE_EFFECTS");
  }
  if (receipt.live_ai_proof !== false || receipt.human_verdict !== "pending") stop("CAPTURE_CLAIM");
  return receipt;
}

export function assertCompleteUniqueCaptures(captures, control) {
  const expected = control.states.map(({ id }) => id).sort();
  const actual = captures.map(({ state }) => state).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) stop("CAPTURE_SET");
  if (new Set(captures.map(({ state }) => state)).size !== captures.length) stop("DUPLICATE_STATE");
  if (new Set(captures.map(({ image_sha256: hash }) => hash)).size !== captures.length) stop("DUPLICATE_IMAGE");
}

function exactKeys(value, keys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) stop(code);
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) stop(code);
}

function isTimestamp(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) && !Number.isNaN(Date.parse(value));
}

function stop(code) {
  throw new Error(`STOP_S2_T246_${code}`);
}
