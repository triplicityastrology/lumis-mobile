import { createHash } from "node:crypto";

const SHA = /^[0-9a-f]{40}$/;
const SESSION = /^[0-9a-f]{64}$/;

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function validateSessionReceipt(receipt, control, sourceSha) {
  const keys = Object.keys(receipt).sort();
  const expected = ["build_marker", "created_at", "device_udid", "port", "route_prefix", "schema", "session_nonce", "source_sha"].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) throw new Error("SESSION_FIELDS_INVALID");
  if (receipt.schema !== "s2_t243_dice_capture_session_v1") throw new Error("SESSION_SCHEMA_INVALID");
  if (!SHA.test(receipt.source_sha) || receipt.source_sha !== sourceSha) throw new Error("SESSION_SOURCE_INVALID");
  if (receipt.build_marker !== sourceSha) throw new Error("SESSION_MARKER_INVALID");
  if (!SESSION.test(receipt.session_nonce)) throw new Error("SESSION_NONCE_INVALID");
  if (receipt.route_prefix !== control.route_prefix) throw new Error("SESSION_ROUTE_INVALID");
  if (receipt.device_udid !== control.device_udid) throw new Error("SESSION_DEVICE_INVALID");
  if (!Number.isInteger(receipt.port) || receipt.port < 1024 || receipt.port > 65534) throw new Error("SESSION_PORT_INVALID");
  if (!Number.isFinite(Date.parse(receipt.created_at))) throw new Error("SESSION_TIME_INVALID");
  return receipt;
}

export function validateCaptureReceipt(receipt, { control, session, sourceSha, imageBytes, width, height }) {
  const keys = Object.keys(receipt).sort();
  const expected = ["build_marker", "captured_at", "device_udid", "file", "height", "image_sha256", "live_ai_proof", "persistence_writes", "route", "schema", "session_nonce", "source_sha", "state", "units_consumed", "visible_fixture_label", "width"].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) throw new Error("CAPTURE_RECEIPT_FIELDS_INVALID");
  if (receipt.schema !== "s2_t243_dice_capture_receipt_v1") throw new Error("CAPTURE_RECEIPT_SCHEMA_INVALID");
  if (!control.states.includes(receipt.state)) throw new Error("CAPTURE_STATE_INVALID");
  if (receipt.source_sha !== sourceSha || receipt.build_marker !== sourceSha) throw new Error("CAPTURE_SOURCE_MARKER_INVALID");
  if (receipt.session_nonce !== session.session_nonce) throw new Error("CAPTURE_SESSION_INVALID");
  if (receipt.device_udid !== control.device_udid) throw new Error("CAPTURE_DEVICE_INVALID");
  if (receipt.route !== `${control.route_prefix}?state=${receipt.state}`) throw new Error("CAPTURE_ROUTE_STATE_MISMATCH");
  if (receipt.visible_fixture_label !== `STATE ${receipt.state}`) throw new Error("CAPTURE_HEADER_PRODUCT_MISMATCH");
  if (receipt.file !== `captures/${receipt.state}.png`) throw new Error("CAPTURE_FILE_STATE_MISMATCH");
  if (receipt.live_ai_proof !== false || receipt.units_consumed !== 0 || receipt.persistence_writes !== 0) throw new Error("CAPTURE_ZERO_EFFECT_INVALID");
  if (receipt.width !== width || receipt.height !== height || width !== control.expected_dimensions.width || height !== control.expected_dimensions.height) throw new Error("CAPTURE_DIMENSIONS_INVALID");
  if (receipt.image_sha256 !== sha256(imageBytes)) throw new Error("CAPTURE_HASH_INVALID");
  if (!Number.isFinite(Date.parse(receipt.captured_at))) throw new Error("CAPTURE_TIME_INVALID");
  return receipt;
}

export function rejectDuplicateCaptures(captures) {
  const hashes = captures.map((capture) => capture.image_sha256);
  if (new Set(hashes).size !== hashes.length) throw new Error("CAPTURE_DUPLICATE_IMAGE");
}
