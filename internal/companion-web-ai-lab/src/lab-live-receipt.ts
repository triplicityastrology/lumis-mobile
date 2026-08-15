// Immutable authorization RECEIPT for the live 12-case window.
//
// The server must NOT construct or refresh a window from the current clock. Instead it loads one
// immutable receipt file (operator/Founder-minted, out of band), verifies its exact checksum and
// identity bindings, and uses the receipt's FIXED issued_at / valid_until. A receipt-bound seal
// (co-located with the receipt) makes the single-use window survive ledger deletion.
//
// This module is self-contained (no import from lab-live-window) to avoid an import cycle: the
// caller passes the expected identity bindings computed from the window module.

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { validateFounderChatWindowAuthority } from "../../../supabase/functions/_shared/founder-chat-window-v1.ts";

export const RECEIPT_SCHEMA = "lumis_companion_web_ai_lab_authorization_receipt_v1" as const;

export type ReceiptCaps = {
  logical: number; en: number; zh_hant: number; attempts: number; concurrency: number;
  deadline_ms: number; retries: number; input_tokens: number; output_tokens: number;
};

export type ReceiptExpected = {
  scope: string;
  packetSha: string;
  diceSha: string;
  registryChecksum: string;
  packageChecksum: string;
  continuationCommit: string;
  fixtureIds: readonly string[];
  caps: ReceiptCaps;
};

export type AuthorizationReceipt = {
  schema: typeof RECEIPT_SCHEMA;
  scope: string;
  founder_packet_sha256: string;
  accepted_dice_evidence_sha256: string;
  registry_checksum: string;
  continuation_commit: string;
  package_checksum: string;
  fixture_ids: string[];
  caps: ReceiptCaps;
  issued_at: string;
  valid_until: string;
  normal_chat_integration_authorized: false;
  member_traffic_authorized: false;
  persistence_authorized: false;
  units_authorized: false;
  receipt_checksum: string;
};

export type VerifiedReceipt = { receiptChecksum: string; issuedAtMs: number; validUntilMs: number };
export type ReceiptSeal = { receiptChecksum: string; windowId: string; activatedAt: number };

// Deterministic canonical body (excludes receipt_checksum), fixed key order.
function canonicalBody(r: Record<string, unknown>): string {
  const c = r.caps as ReceiptCaps;
  return JSON.stringify({
    schema: r.schema, scope: r.scope, founder_packet_sha256: r.founder_packet_sha256,
    accepted_dice_evidence_sha256: r.accepted_dice_evidence_sha256, registry_checksum: r.registry_checksum,
    continuation_commit: r.continuation_commit, package_checksum: r.package_checksum, fixture_ids: r.fixture_ids,
    caps: { logical: c.logical, en: c.en, zh_hant: c.zh_hant, attempts: c.attempts, concurrency: c.concurrency, deadline_ms: c.deadline_ms, retries: c.retries, input_tokens: c.input_tokens, output_tokens: c.output_tokens },
    issued_at: r.issued_at, valid_until: r.valid_until,
    normal_chat_integration_authorized: r.normal_chat_integration_authorized, member_traffic_authorized: r.member_traffic_authorized,
    persistence_authorized: r.persistence_authorized, units_authorized: r.units_authorized,
  });
}

export function computeReceiptChecksum(r: Record<string, unknown>): string {
  return createHash("sha256").update(canonicalBody(r)).digest("hex");
}

// Mint a receipt (OPERATOR / TEST ONLY — never invoked by the server request path).
export function mintReceipt(expected: ReceiptExpected, issuedAtMs: number, validUntilMs: number): AuthorizationReceipt {
  const body = {
    schema: RECEIPT_SCHEMA, scope: expected.scope, founder_packet_sha256: expected.packetSha,
    accepted_dice_evidence_sha256: expected.diceSha, registry_checksum: expected.registryChecksum,
    continuation_commit: expected.continuationCommit, package_checksum: expected.packageChecksum,
    fixture_ids: [...expected.fixtureIds], caps: { ...expected.caps },
    issued_at: new Date(issuedAtMs).toISOString(), valid_until: new Date(validUntilMs).toISOString(),
    normal_chat_integration_authorized: false as const, member_traffic_authorized: false as const,
    persistence_authorized: false as const, units_authorized: false as const,
  };
  return { ...body, receipt_checksum: computeReceiptChecksum(body) };
}

const RECEIPT_KEYS = [
  "schema", "scope", "founder_packet_sha256", "accepted_dice_evidence_sha256", "registry_checksum",
  "continuation_commit", "package_checksum", "fixture_ids", "caps", "issued_at", "valid_until",
  "normal_chat_integration_authorized", "member_traffic_authorized", "persistence_authorized", "units_authorized", "receipt_checksum",
];

// Verify a receipt object against the expected identity bindings and the current time.
// Throws Error whose message is a stable rejection code.
export function verifyReceipt(obj: unknown, nowMs: number, expected: ReceiptExpected): VerifiedReceipt {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("LAB_LIVE_RECEIPT_INVALID");
  const r = obj as Record<string, unknown>;
  const keys = Object.keys(r);
  if (keys.length !== RECEIPT_KEYS.length || keys.some((k) => !RECEIPT_KEYS.includes(k))) throw new Error("LAB_LIVE_RECEIPT_INVALID");
  if (typeof r.receipt_checksum !== "string" || computeReceiptChecksum(r) !== r.receipt_checksum) throw new Error("LAB_LIVE_RECEIPT_CHECKSUM_MISMATCH");
  if (r.schema !== RECEIPT_SCHEMA) throw new Error("LAB_LIVE_RECEIPT_INVALID");

  // Identity bindings not covered by the reused Founder authority contract.
  if (r.registry_checksum !== expected.registryChecksum || r.package_checksum !== expected.packageChecksum ||
      r.continuation_commit !== expected.continuationCommit) {
    throw new Error("LAB_LIVE_RECEIPT_IDENTITY_MISMATCH");
  }

  // Fixed times: expired if valid_until has passed. (issued_at in the future / >900s window are INVALID.)
  const issuedAtMs = Date.parse(String(r.issued_at));
  const validUntilMs = Date.parse(String(r.valid_until));
  if (!Number.isFinite(issuedAtMs) || !Number.isFinite(validUntilMs)) throw new Error("LAB_LIVE_RECEIPT_INVALID");
  if (validUntilMs <= nowMs) throw new Error("LAB_LIVE_RECEIPT_EXPIRED");

  // Reuse the repo's Founder window authority contract: it re-checks scope, packet, dice, the exact
  // fixture ids, caps, issued<=now, expires>now, window<=900s, and the four *_authorized=false flags.
  const auth = {
    schema: "lumis_founder_chat_synthetic_window_authorization_v1", decision: "AUTHORIZED", scope: r.scope,
    accepted_dice_evidence_sha256: r.accepted_dice_evidence_sha256, review_package_sha256: r.founder_packet_sha256,
    fixture_ids: r.fixture_ids, caps: r.caps, issued_at: r.issued_at, valid_until: r.valid_until,
    normal_chat_integration_authorized: r.normal_chat_integration_authorized, member_traffic_authorized: r.member_traffic_authorized,
    persistence_authorized: r.persistence_authorized, units_authorized: r.units_authorized,
  };
  try { validateFounderChatWindowAuthority(auth, nowMs, expected.packetSha); }
  catch { throw new Error("LAB_LIVE_RECEIPT_IDENTITY_MISMATCH"); }

  return { receiptChecksum: String(r.receipt_checksum), issuedAtMs, validUntilMs };
}

// ---- File I/O (receipt is read-only; seal is atomic and co-located with the receipt) ----
export function receiptPath(): string {
  return (process.env.LAB_LIVE_RECEIPT_PATH ?? "").trim();
}
export function sealPath(): string {
  return `${receiptPath()}.seal`;
}

// Load + verify the receipt file. Throws LAB_LIVE_RECEIPT_MISSING / _INVALID / _CHECKSUM_MISMATCH /
// _IDENTITY_MISMATCH / _EXPIRED.
export function loadReceipt(nowMs: number, expected: ReceiptExpected): VerifiedReceipt {
  const p = receiptPath();
  if (!p || !existsSync(p)) throw new Error("LAB_LIVE_RECEIPT_MISSING");
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(p, "utf8")); }
  catch { throw new Error("LAB_LIVE_RECEIPT_INVALID"); }
  return verifyReceipt(parsed, nowMs, expected);
}

export function readSeal(): ReceiptSeal | null {
  const p = sealPath();
  if (!existsSync(p)) return null;
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8")) as ReceiptSeal;
    if (parsed && typeof parsed.receiptChecksum === "string" && typeof parsed.windowId === "string" && Number.isFinite(parsed.activatedAt)) return parsed;
  } catch { /* fall through */ }
  throw new Error("LAB_LIVE_SEAL_INVALID");
}

export function writeSeal(seal: ReceiptSeal): void {
  const p = sealPath();
  const dir = p.slice(0, p.lastIndexOf("/"));
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const temporary = `${p}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(temporary, JSON.stringify(seal), { flag: "wx", mode: 0o600 });
    renameSync(temporary, p);
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
  }
}
