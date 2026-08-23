import { DICE_FOUNDER_FIXTURES, DICE_FOUNDER_FIXTURE_REGISTRY_SHA256 } from "../../../apps/mobile/src/services/diceFounderFixtureRegistry.ts";
import { classifyDiceQuestionRequest, detectDiceQuestionLanguage } from "../../../packages/shared/src/config/dice-question-boundary.ts";
import { buildDiceV03Prompt, parseDiceV03Output, DICE_V03_PROMPT_VERSION, type DiceV03ModelResult } from "./dice-v0-3-interpretation-contract.ts";
import { measureDiceTokenLimit } from "./dice-tokenizer-v1.ts";
import type { DiceProviderAdapter } from "./dice-synthetic-gateway-port-v1.ts";

export const DICE_FOUNDER_WINDOW_SCOPE = "DICE_FOUNDER_SYNTHETIC_WINDOW_40_ONLY" as const;
export const DICE_FOUNDER_WINDOW_RECEIPT_SCHEMA = "lumis_dice_founder_web_lab_window_authorization_v1" as const;
export const DICE_FOUNDER_TECHNICAL_EVIDENCE_SHA256 = "f9503a7a78817ffd92ddd48008f003af93c2deeff613de72a43618ca7542c612" as const;
export const DICE_FOUNDER_ISSUER_KEY_ID = "founder-ed25519-deployment-approver-v1" as const;
export const DICE_FOUNDER_ISSUER_SPKI_SHA256 = "ee1d1e2643e525d4de8e1604b127a718260bd8234561af262ab6685873f47478" as const;
export const DICE_FOUNDER_REQUEST_FIELDS = Object.freeze(["fixture_id", "planet_id", "sign_id", "house_id"] as const);
const PLANETS = new Set(["sun","moon","mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto","north_node","south_node"]);
const SIGNS = new Set(["aries","taurus","gemini","cancer","leo","virgo","libra","scorpio","sagittarius","capricorn","aquarius","pisces"]);
const HOUSES = new Set(Array.from({ length: 12 }, (_, index) => `house_${index + 1}`));
const SHA = /^[a-f0-9]{64}$/u;

export type FounderDiceRequest = Readonly<{ fixture_id: string; planet_id: string; sign_id: string; house_id: string }>;
export type FounderDiceFreeTextRequest = Readonly<{ question: string; planet_id: string; sign_id: string; house_id: string }>;
export type FounderWindowReceipt = Readonly<Record<string, any> & { single_use_window_id: string; valid_until: string }>;
export interface FounderAuthorityRpcClient { rpc(name: string, parameters: Readonly<Record<string, unknown>>): Promise<Readonly<{ data: unknown; error: unknown }>>; }

const exact = (value: unknown, keys: readonly string[]): boolean => typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
const canonical = (value: unknown): string => Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : value && typeof value === "object" ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}` : JSON.stringify(value);
const fromBase64Url = (value: string): ArrayBuffer => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (character) => character.charCodeAt(0)).buffer as ArrayBuffer;
const pemDer = (pem: string): ArrayBuffer => fromBase64Url(pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, ""));
const hex = (bytes: ArrayBuffer): string => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

export function parseFounderDiceRequest(value: unknown): FounderDiceRequest | null {
  if (!exact(value, DICE_FOUNDER_REQUEST_FIELDS)) return null;
  const request = value as Record<string, unknown>;
  if (DICE_FOUNDER_REQUEST_FIELDS.some((key) => typeof request[key] !== "string")) return null;
  if (!DICE_FOUNDER_FIXTURES.some((fixture) => fixture.fixture_id === request.fixture_id) || !PLANETS.has(request.planet_id as string) || !SIGNS.has(request.sign_id as string) || !HOUSES.has(request.house_id as string)) return null;
  return Object.freeze(request as FounderDiceRequest);
}

export function parseFounderDiceFreeTextRequest(value: unknown): FounderDiceFreeTextRequest | null {
  const keys = ["question", "planet_id", "sign_id", "house_id"] as const;
  if (!exact(value, keys)) return null;
  const request = value as Record<string, unknown>;
  if (keys.some((key) => typeof request[key] !== "string") ||
      !PLANETS.has(request.planet_id as string) || !SIGNS.has(request.sign_id as string) || !HOUSES.has(request.house_id as string)) return null;
  const question = (request.question as string).trim();
  if (!question || [...question].length > 280) return null;
  return Object.freeze({ ...request, question } as FounderDiceFreeTextRequest);
}

export async function verifyFounderWindowReceipt(encoded: string, claimedSha256: string, publicKeyPem: string, now = Date.now()): Promise<Readonly<{ receipt: FounderWindowReceipt; receiptSha256: string }>> {
  const bytes = fromBase64Url(encoded);
  const digest = hex(await crypto.subtle.digest("SHA-256", bytes));
  if (digest !== claimedSha256 || !SHA.test(digest)) throw new Error("DICE_FOUNDER_RECEIPT_DIGEST_INVALID");
  const receipt = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, any>;
  const keys = ["schema","issuer","decision","authorization_scope","request_sha256","source_commit","single_use_window_id","issued_at","valid_until","technical_evidence_sha256","founder_registry_sha256","lab_package_sha256","fixture_total","language_totals","request_fields","provider_attempt_cap","concurrency_cap","shared_deadline_ms","input_token_cap","output_token_cap","cost_ceiling_usd","raw_response_retention","metadata_export_only","member_data","persistence_writes","units_charged","normal_chat_authorized","signature_algorithm","issuer_key_id","issuer_public_key_spki_sha256","trust_anchor_owner","issuer_signature_base64"];
  const issuedAt = Date.parse(receipt?.issued_at);
  const validUntil = Date.parse(receipt?.valid_until);
  if (!exact(receipt, keys) || receipt.schema !== DICE_FOUNDER_WINDOW_RECEIPT_SCHEMA || receipt.issuer !== "Lumis Founder Deployment Approver" || receipt.decision !== "AUTHORIZED" || receipt.authorization_scope !== DICE_FOUNDER_WINDOW_SCOPE ||
      receipt.technical_evidence_sha256 !== DICE_FOUNDER_TECHNICAL_EVIDENCE_SHA256 || receipt.founder_registry_sha256 !== DICE_FOUNDER_FIXTURE_REGISTRY_SHA256 || receipt.fixture_total !== 40 || receipt.language_totals?.en !== 20 || receipt.language_totals?.["zh-Hant"] !== 20 ||
      JSON.stringify(receipt.request_fields) !== JSON.stringify(DICE_FOUNDER_REQUEST_FIELDS) || receipt.provider_attempt_cap !== 80 || receipt.concurrency_cap !== 1 || receipt.shared_deadline_ms !== 12000 || receipt.input_token_cap !== 800 || receipt.output_token_cap !== 300 || receipt.cost_ceiling_usd !== 0.064 ||
      receipt.raw_response_retention !== "session_memory_only" || receipt.metadata_export_only !== true || receipt.member_data !== 0 || receipt.persistence_writes !== 0 || receipt.units_charged !== 0 || receipt.normal_chat_authorized !== false ||
      receipt.signature_algorithm !== "Ed25519" || receipt.issuer_key_id !== DICE_FOUNDER_ISSUER_KEY_ID || receipt.issuer_public_key_spki_sha256 !== DICE_FOUNDER_ISSUER_SPKI_SHA256 || receipt.trust_anchor_owner !== "Founder" ||
      !/^dice-founder40-[a-z0-9]{16,40}$/u.test(receipt.single_use_window_id) || !SHA.test(receipt.request_sha256) || !SHA.test(receipt.lab_package_sha256) || !/^[a-f0-9]{40}$/u.test(receipt.source_commit) ||
      !Number.isFinite(issuedAt) || !Number.isFinite(validUntil) || issuedAt > now || validUntil <= now || validUntil > issuedAt + 900000) throw new Error("DICE_FOUNDER_RECEIPT_INVALID");
  const der = pemDer(publicKeyPem);
  if (hex(await crypto.subtle.digest("SHA-256", der)) !== DICE_FOUNDER_ISSUER_SPKI_SHA256) throw new Error("DICE_FOUNDER_TRUST_ANCHOR_INVALID");
  const key = await crypto.subtle.importKey("spki", der, { name: "Ed25519" }, false, ["verify"]);
  const { issuer_signature_base64, ...payload } = receipt;
  if (!await crypto.subtle.verify("Ed25519", key, fromBase64Url(issuer_signature_base64), new TextEncoder().encode(canonical(payload)))) throw new Error("DICE_FOUNDER_SIGNATURE_INVALID");
  return Object.freeze({ receipt: Object.freeze(receipt as FounderWindowReceipt), receiptSha256: digest });
}

export async function executeFounderDiceCase(input: FounderDiceRequest, receipt: FounderWindowReceipt, receiptSha256: string, adapter: DiceProviderAdapter, authority: FounderAuthorityRpcClient, now = () => Date.now()) {
  const fixture = DICE_FOUNDER_FIXTURES.find((entry) => entry.fixture_id === input.fixture_id)!;
  const decision = classifyDiceQuestionRequest({ question: fixture.exact_text });
  const acquisition = await authority.rpc("consume_lumis_dice_founder_window_case_v1", { p_window_id: receipt.single_use_window_id, p_fixture_id: fixture.fixture_id, p_receipt_sha256: receiptSha256, p_valid_until: receipt.valid_until });
  if (acquisition.error || (acquisition.data as Record<string, unknown> | null)?.consumed !== true) throw new Error("DICE_FOUNDER_AUTHORITY_REJECTED");
  if (!decision.accepted) return Object.freeze({ kind: decision.code.includes("SAFETY") || decision.code.includes("PROFESSIONAL") ? "safety" : "fallback", code: decision.code, metadata: metadata(fixture, 0, "safety", "zero", "zero", "zero") });
  const prompt = buildDiceV03Prompt({ fixture_id: fixture.fixture_id, question: fixture.exact_text, language: decision.language, question_shape: decision.shape, outcome: { planet: input.planet_id, sign: input.sign_id, house: input.house_id } });
  if (!measureDiceTokenLimit(prompt, 800).within_limit) return Object.freeze({ kind: "fallback", code: "DICE_INPUT_TOKEN_CAP", metadata: metadata(fixture, 0, "fallback", "zero", "zero", "zero") });
  const started = now();
  const deadline = started + 12000;
  try {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.max(0, deadline - now()));
      const response = await adapter.invoke({ prompt, prompt_version: DICE_V03_PROMPT_VERSION, language: decision.language, question_shape: decision.shape, deadline_at_ms: deadline, max_output_tokens: 300, signal: controller.signal }).catch(() => ({ kind: "network" as const }));
      clearTimeout(timer);
      if (response.kind === "success") {
        const measured = measureDiceTokenLimit(response.content, 300);
        const output = measured.within_limit ? parseDiceV03Output(response.content, { language: decision.language, question_shape: decision.shape }) : null;
        if (!output) return Object.freeze({ kind: "fallback", code: "DICE_PROVIDER_MALFORMED", provider_disposition: "responses_completed_schema_invalid" as const, metadata: metadata(fixture, attempt, "fallback", "lt_12s", "lt_800", "lt_300") });
        if (output.kind === "route_mismatch") return Object.freeze({ kind: "route_mismatch", code: output.envelope.code, metadata: metadata(fixture, attempt, "route_mismatch", "lt_12s", "lt_800", "zero") });
        return Object.freeze({ kind: "completed", result: output.result as DiceV03ModelResult, provider_disposition: response.provider_disposition, metadata: metadata(fixture, attempt, "completed", "lt_12s", "lt_800", "lt_300") });
      }
      if (["authentication","permission","content_filter_block","content_filter_partial"].includes(response.kind) || attempt === 2 || now() >= deadline) return Object.freeze({ kind: response.kind.startsWith("content_filter") ? "safety" : "fallback", code: `DICE_${response.kind.toUpperCase()}`, provider_disposition: "provider_disposition" in response ? response.provider_disposition : undefined, metadata: metadata(fixture, attempt, response.kind.startsWith("content_filter") ? "safety" : "fallback", "lt_12s", "lt_800", "zero") });
    }
    throw new Error("DICE_FOUNDER_RETRY_INVALID");
  } finally {
    await authority.rpc("release_lumis_dice_founder_window_case_v1", { p_window_id: receipt.single_use_window_id, p_fixture_id: fixture.fixture_id });
  }
}

export async function executeFounderDiceFreeTextCase(input: FounderDiceFreeTextRequest, adapterSource: DiceProviderAdapter | (() => DiceProviderAdapter), now = () => Date.now()) {
  const decision = classifyDiceQuestionRequest({ question: input.question });
  const language = decision.accepted ? decision.language : detectDiceQuestionLanguage(input.question);
  if (!decision.accepted) {
    const safety = decision.code.includes("SAFETY") || decision.code.includes("PROFESSIONAL");
    return Object.freeze({
      kind: safety ? "safety" : "fallback",
      code: decision.code,
      classification: Object.freeze({ accepted: false, language, code: decision.code }),
      metadata: freeTextMetadata(language, 0, safety ? "safety" : "fallback", "zero", "zero", "zero"),
    });
  }
  const prompt = buildDiceV03Prompt({ fixture_id: "founder-free-text", question: decision.normalized_question, language: decision.language, question_shape: decision.shape, outcome: { planet: input.planet_id, sign: input.sign_id, house: input.house_id } });
  if (!measureDiceTokenLimit(prompt, 1600).within_limit) return Object.freeze({ kind: "fallback", code: "DICE_INPUT_TOKEN_CAP", classification: classification(decision), metadata: freeTextMetadata(decision.language, 0, "fallback", "zero", "zero", "zero") });
  const adapter = typeof adapterSource === "function" ? adapterSource() : adapterSource;
  const deadline = now() + 12000;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(0, deadline - now()));
    const response = await adapter.invoke({ prompt, prompt_version: DICE_V03_PROMPT_VERSION, language: decision.language, question_shape: decision.shape, deadline_at_ms: deadline, max_output_tokens: 600, signal: controller.signal }).catch(() => ({ kind: "network" as const }));
    clearTimeout(timer);
    if (response.kind === "success") {
      const measured = measureDiceTokenLimit(response.content, 600);
      const output = measured.within_limit ? parseDiceV03Output(response.content, { language: decision.language, question_shape: decision.shape }) : null;
      if (!output) return Object.freeze({ kind: "fallback", code: "DICE_PROVIDER_MALFORMED", provider_disposition: "responses_completed_schema_invalid" as const, classification: classification(decision), metadata: freeTextMetadata(decision.language, attempt, "fallback", "lt_12s", "lt_1600", "lt_600") });
      if (output.kind === "route_mismatch") return Object.freeze({ kind: "route_mismatch", code: output.envelope.code, classification: classification(decision), metadata: freeTextMetadata(decision.language, attempt, "route_mismatch", "lt_12s", "lt_1600", "zero") });
      return Object.freeze({ kind: "completed", result: output.result, provider_disposition: response.provider_disposition, classification: classification(decision), metadata: freeTextMetadata(decision.language, attempt, "completed", "lt_12s", "lt_1600", "lt_600") });
    }
    if (["authentication", "permission", "content_filter_block", "content_filter_partial"].includes(response.kind) || attempt === 2 || now() >= deadline) {
      const safety = response.kind.startsWith("content_filter");
      return Object.freeze({ kind: safety ? "safety" : "fallback", code: `DICE_${response.kind.toUpperCase()}`, provider_disposition: "provider_disposition" in response ? response.provider_disposition : undefined, classification: classification(decision), metadata: freeTextMetadata(decision.language, attempt, safety ? "safety" : "fallback", "lt_12s", "lt_800", "zero") });
    }
  }
  throw new Error("DICE_FOUNDER_RETRY_INVALID");
}

function classification(decision: Extract<ReturnType<typeof classifyDiceQuestionRequest>, { accepted: true }>) {
  return Object.freeze({ accepted: true, language: decision.language, route: decision.route, shape: decision.shape });
}

function freeTextMetadata(language: "en" | "zh-Hant", attempts: number, result: string, latency: string, input: string, output: string) {
  return Object.freeze({ request_mode: "founder_free_text", language, result_class: result, attempt_count: attempts, latency_bucket: latency, input_token_bucket: input, output_token_bucket: output, cost_bucket: attempts ? "within_cap" : "zero" });
}

function metadata(fixture: typeof DICE_FOUNDER_FIXTURES[number], attempts: number, result: string, latency: string, input: string, output: string) {
  return Object.freeze({ fixture_id: fixture.fixture_id, language: fixture.language, result_class: result, attempt_count: attempts, latency_bucket: latency, input_token_bucket: input, output_token_bucket: output, cost_bucket: attempts ? "within_cap" : "zero" });
}
