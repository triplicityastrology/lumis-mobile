#!/usr/bin/env node
import { createHash, createPublicKey, timingSafeEqual, verify } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import {
  MOBILE_DICE_REQUEST_KEYS,
  projectMobileDiceFreeTextUpstream,
  projectMobileDiceUpstream,
  validateMobileDiceFreeTextRelayRequest,
  validateMobileDiceRelayRequest,
} from "./lib/founder-mobile-dice-relay.mjs";

const PROJECT_ORIGIN = "https://bmqhwofmdgebpcihjlnb.supabase.co";
const FUNCTION_URL = `${PROJECT_ORIGIN}/functions/v1/dice-synthetic`;
const TRUSTED_SPKI_SHA256 = "ee1d1e2643e525d4de8e1604b127a718260bd8234561af262ab6685873f47478";
const TECHNICAL_EVIDENCE_SHA256 = "f9503a7a78817ffd92ddd48008f003af93c2deeff613de72a43618ca7542c612";
const REGISTRY_SHA256 = "a6f2700b5b689bc00a130bde083e2efbce1a83ac64df8ddaee5565b2f2e9d211";
const ACCEPTED_T348_SOURCE_COMMIT = "be92814f6a466fdd56f0fd1e86fd10d5277dbd78";
const ACCEPTED_T348_PACKAGE_SHA256 = "420cfb312d1c6a5973584def1a912a5182bff6edf3f831feae51a20e70543d0a";
const RECEIPT_KEYS = [
  "schema", "issuer", "decision", "authorization_scope", "request_sha256", "source_commit", "single_use_window_id", "issued_at", "valid_until",
  "technical_evidence_sha256", "founder_registry_sha256", "lab_package_sha256", "fixture_total", "language_totals", "request_fields",
  "provider_attempt_cap", "concurrency_cap", "shared_deadline_ms", "input_token_cap", "output_token_cap", "cost_ceiling_usd", "raw_response_retention",
  "metadata_export_only", "member_data", "persistence_writes", "units_charged", "normal_chat_authorized", "signature_algorithm", "issuer_key_id",
  "issuer_public_key_spki_sha256", "trust_anchor_owner", "issuer_signature_base64",
];

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`STOP_MOBILE_DICE_RELAY_${name}_MISSING`);
  return value;
};
const exactKeys = (value, expected) => record(value) && Object.keys(value).length === expected.length && Object.keys(value).every((key) => expected.includes(key));
const record = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) => Array.isArray(value)
  ? `[${value.map(canonical).join(",")}]`
  : record(value)
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
    : JSON.stringify(value);

const port = Number(required("LUMIS_DICE_MOBILE_RELAY_PORT"));
const session = required("LUMIS_DICE_MOBILE_RELAY_SESSION");
const anonKey = required("LUMIS_DICE_MOBILE_ANON_KEY");
const freeTextAccessKey = required("LUMIS_DICE_MOBILE_FREE_TEXT_ACCESS_KEY");
const receiptPath = process.env.LUMIS_DICE_FOUNDER_RECEIPT_FILE?.trim() ?? "";
const expectedReceiptSha256 = process.env.LUMIS_DICE_FOUNDER_RECEIPT_SHA256?.trim() ?? "";
const publicKeyPath = process.env.LUMIS_DICE_FOUNDER_PUBLIC_KEY_FILE?.trim() ?? "";
const fixtureMode = [receiptPath, expectedReceiptSha256, publicKeyPath].every(Boolean);
if ([receiptPath, expectedReceiptSha256, publicKeyPath].some(Boolean) && !fixtureMode) throw new Error("STOP_MOBILE_DICE_RELAY_FIXTURE_CONFIGURATION_INCOMPLETE");
if (!Number.isInteger(port) || port < 1024 || port > 65535 || !/^[A-Za-z0-9_-]{43}$/u.test(session) ||
    freeTextAccessKey.length < 32 || (fixtureMode && !/^[a-f0-9]{64}$/u.test(expectedReceiptSha256))) {
  throw new Error("STOP_MOBILE_DICE_RELAY_CONFIGURATION_INVALID");
}

const registry = JSON.parse(await readFile(new URL("../config/s2-t314-founder-fixture-registry.json", import.meta.url), "utf8"));
const fixtureIds = new Set(registry.fixtures?.map((fixture) => fixture.fixture_id));
if (registry.fixture_total !== 40 || fixtureIds.size !== 40) throw new Error("STOP_MOBILE_DICE_RELAY_REGISTRY_INVALID");

let receipt = null;
if (fixtureMode) {
  const receiptBytes = await readFile(receiptPath);
  if (sha256(receiptBytes) !== expectedReceiptSha256) throw new Error("STOP_MOBILE_DICE_RELAY_RECEIPT_SHA256_MISMATCH");
  receipt = JSON.parse(receiptBytes.toString("utf8"));
  const issuedAt = Date.parse(receipt.issued_at);
  const validUntil = Date.parse(receipt.valid_until);
  if (!exactKeys(receipt, RECEIPT_KEYS) || receipt.schema !== "lumis_dice_founder_web_lab_window_authorization_v1" ||
      receipt.issuer !== "Lumis Founder Deployment Approver" || receipt.decision !== "AUTHORIZED" ||
      receipt.authorization_scope !== "DICE_FOUNDER_SYNTHETIC_WINDOW_40_ONLY" || receipt.technical_evidence_sha256 !== TECHNICAL_EVIDENCE_SHA256 ||
      receipt.source_commit !== ACCEPTED_T348_SOURCE_COMMIT || receipt.lab_package_sha256 !== ACCEPTED_T348_PACKAGE_SHA256 ||
      receipt.founder_registry_sha256 !== REGISTRY_SHA256 || receipt.fixture_total !== 40 || receipt.language_totals?.en !== 20 || receipt.language_totals?.["zh-Hant"] !== 20 ||
      JSON.stringify(receipt.request_fields) !== JSON.stringify(MOBILE_DICE_REQUEST_KEYS) || receipt.provider_attempt_cap !== 80 || receipt.concurrency_cap !== 1 ||
      receipt.shared_deadline_ms !== 12_000 || receipt.input_token_cap !== 800 || receipt.output_token_cap !== 300 || receipt.cost_ceiling_usd !== 0.064 ||
      receipt.raw_response_retention !== "session_memory_only" || receipt.metadata_export_only !== true || receipt.member_data !== 0 ||
      receipt.persistence_writes !== 0 || receipt.units_charged !== 0 || receipt.normal_chat_authorized !== false || receipt.signature_algorithm !== "Ed25519" ||
      receipt.issuer_public_key_spki_sha256 !== TRUSTED_SPKI_SHA256 || receipt.trust_anchor_owner !== "Founder" ||
      !Number.isFinite(issuedAt) || !Number.isFinite(validUntil) || validUntil <= Date.now() || validUntil > issuedAt + 900_000) {
    throw new Error("STOP_MOBILE_DICE_RELAY_RECEIPT_INVALID");
  }
  const publicKey = createPublicKey(await readFile(publicKeyPath, "utf8"));
  if (sha256(publicKey.export({ type: "spki", format: "der" })) !== TRUSTED_SPKI_SHA256) throw new Error("STOP_MOBILE_DICE_RELAY_TRUST_ANCHOR_MISMATCH");
  const { issuer_signature_base64: signature, ...signedPayload } = receipt;
  if (!verify(null, Buffer.from(canonical(signedPayload), "utf8"), publicKey, Buffer.from(signature, "base64"))) {
    throw new Error("STOP_MOBILE_DICE_RELAY_SIGNATURE_INVALID");
  }
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") return json(response, 200, { status: "ready" });
  if (request.method !== "POST" || !["/dice", "/dice-free-text"].includes(request.url ?? "") || !sameSession(request.headers["x-lumis-mobile-dice-session"])) {
    return json(response, 404, { error: "DICE_GATEWAY_UNAVAILABLE" });
  }
  const body = await readBody(request).catch(() => null);
  if (request.url === "/dice-free-text") {
    if (!validateMobileDiceFreeTextRelayRequest(body)) return json(response, 400, { error: "DICE_REQUEST_SCHEMA_INVALID" });
    try {
      const upstream = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
          "content-type": "application/json",
          "x-lumis-founder-free-text-access": freeTextAccessKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12_000),
      });
      const payload = await upstream.json().catch(() => null);
      const language = /[\u3400-\u9fff\uf900-\ufaff]/u.test(body.question) ? "zh-Hant" : "en";
      const projected = projectMobileDiceFreeTextUpstream(upstream.status, payload, language);
      return json(response, projected.status, projected.body);
    } catch {
      return json(response, 504, { error: "DICE_GATEWAY_UNAVAILABLE" });
    }
  }
  if (!fixtureMode || !receipt) return json(response, 404, { error: "DICE_GATEWAY_UNAVAILABLE" });
  if (!validateMobileDiceRelayRequest(body, fixtureIds)) {
    return json(response, 400, { error: "DICE_REQUEST_SCHEMA_INVALID" });
  }
  try {
    const upstream = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
        "content-type": "application/json",
        "x-lumis-founder-window-receipt-sha256": expectedReceiptSha256,
        "x-lumis-founder-window-authorization": Buffer.from(JSON.stringify(receipt), "utf8").toString("base64url"),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await upstream.json().catch(() => null);
    const projected = projectMobileDiceUpstream(upstream.status, payload, body.fixture_id);
    return json(response, projected.status, projected.body);
  } catch {
    return json(response, 504, { error: "DICE_GATEWAY_UNAVAILABLE" });
  }
});

server.listen(port, "0.0.0.0", () => process.stdout.write("FOUNDER_MOBILE_DICE_RELAY_READY\n"));

function sameSession(value) {
  if (typeof value !== "string" || value.length !== session.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(session));
}
async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 4096) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(`${JSON.stringify(body)}\n`);
}
