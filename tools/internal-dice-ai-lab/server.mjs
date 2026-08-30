#!/usr/bin/env node
/** Loopback-only Founder Dice Lab. Live credentials remain server-side; raw content is session-only. */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  createFounderDiceGatewayClient,
  createFounderDiceFreeTextGatewayClient,
  createFounderDiceV05FreeTextGatewayClient,
  loadAcceptedTechnicalEvidence,
  loadFounderWindowReceipt,
  redactLiveMetadata,
  redactV05Metadata,
} from "./founder-live-window.mjs";

// v5 = "Dice AI Interpretation Prompt v3" — technical identity prompt v5 / schema v5.
const V05_PROMPT_VERSION = "lumis_dice_v0_3_prompt_v5";
const V05_RESULT_SCHEMA = "lumis_dice_interpretation_v5";
const V05_MODES = ["timing", "location", "judgment", "person", "reason", "thing_or_situation"];
const V05_HEAD = { reading: { en: "Reading", "zh-Hant": "解讀" }, watch: { en: "One thing to watch", "zh-Hant": "需要留意" }, practical: { en: "Practical step", "zh-Hant": "實際一步" }, result: { en: "Result", "zh-Hant": "結果" }, timing: { en: "Timing", "zh-Hant": "時間節奏" }, followups: { en: "Suggested follow-up questions", "zh-Hant": "建議延伸問題" }, area: { en: "Most likely area", "zh-Hant": "最有可能的範圍" }, candidates: { en: "Where to look", "zh-Hant": "建議尋找位置" }, extension: { en: "Related to the top candidate", "zh-Hant": "與首選相關" } };
const V05_FOLLOWUP_INTRO = { en: "If you want to explore this further, choose one question for a separate throw.", "zh-Hant": "如果你想進一步了解，可以選擇以下其中一個問題，另行擲骰。" };
const V05_ROUTE_REVIEW_COPY = { en: "This question isn’t clear enough for one Dice reading. Please ask one clear question and try again.", "zh-Hant": "這個問題未夠清晰，無法作一次擲骰解讀。請提出一個清晰的問題後再試。" };
const V05_BUNDLED_COPY = { en: "This contains more than one question. Each Dice throw can interpret only one clear question. Please choose one question and try again.", "zh-Hant": "這裡包含多於一個問題。每次擲骰只適用於一個清晰問題，請選擇其中一個問題後再試。" };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const registryPath = path.join(root, "apps/mobile/src/services/diceFounderFixtureRegistry.ts");
const interpretationBankPath = path.join(root, "apps/mobile/src/features/dice/interpretationBank.ts");
const BANNER = "Synthetic staging only — no member data.";
const PORT = Number(process.env.LUMIS_INTERNAL_DICE_LAB_PORT || 8147);
const CONTRACT_COMMIT = "c1ec632fdea1f2677621f8b1bd3a71e72d17f071";
const CONTRACT_SEAL = "d0f0c631aa40cf076d86d0a661fe289466d23593bb117c4a359b7ba46e7c007c";
const RESULT_SCHEMA = "lumis_dice_v0_3_result_v3";
const PROMPT_VERSION = "lumis_dice_v0_3_prompt_v3";
const SAFETY_COPY = Object.freeze({ en: "Lumis can’t help with that request, but it can offer a safer, general reflection instead.", "zh-Hant": "Lumis 無法協助這項要求，但可以改為提供較安全、概括的反思。" });
const FALLBACK_COPY = Object.freeze({ en: "Lumis couldn’t complete that reflection just now. Please try again.", "zh-Hant": "Lumis 暫時未能完成這次反思，請再試一次。" });
const ROUTE_MISMATCH_COPY = Object.freeze({ en: "Lumis couldn’t confirm the correct reading type for this question, so no interpretation was generated. Please rephrase the question clearly and try again.", "zh-Hant": "Lumis 暫時未能確認這個問題適用的解讀方式，因此沒有生成解讀。請清晰地改寫問題後再試。" });

export const PLANET_OPTIONS = Object.freeze([
  ["sun", "☉", "Sun", "太陽"], ["moon", "☽", "Moon", "月亮"], ["mercury", "☿", "Mercury", "水星"],
  ["venus", "♀", "Venus", "金星"], ["mars", "♂", "Mars", "火星"], ["jupiter", "♃", "Jupiter", "木星"],
  ["saturn", "♄", "Saturn", "土星"], ["uranus", "♅", "Uranus", "天王星"], ["neptune", "♆", "Neptune", "海王星"],
  ["pluto", "♇", "Pluto", "冥王星"], ["north_node", "☊", "North Node", "龍頭"], ["south_node", "☋", "South Node", "龍尾"],
].map(([id, glyph, en, zh]) => Object.freeze({ id, glyph, en, zh })));
export const SIGN_OPTIONS = Object.freeze([
  ["aries", "♈", "Aries", "白羊座"], ["taurus", "♉", "Taurus", "金牛座"], ["gemini", "♊", "Gemini", "雙子座"],
  ["cancer", "♋", "Cancer", "巨蟹座"], ["leo", "♌", "Leo", "獅子座"], ["virgo", "♍", "Virgo", "處女座"],
  ["libra", "♎", "Libra", "天秤座"], ["scorpio", "♏", "Scorpio", "天蠍座"], ["sagittarius", "♐", "Sagittarius", "人馬座"],
  ["capricorn", "♑", "Capricorn", "摩羯座"], ["aquarius", "♒", "Aquarius", "水瓶座"], ["pisces", "♓", "Pisces", "雙魚座"],
].map(([id, glyph, en, zh]) => Object.freeze({ id, glyph, en, zh })));
export const HOUSE_OPTIONS = Object.freeze(Array.from({ length: 12 }, (_, index) => {
  const number = index + 1;
  const ordinal = number === 1 ? "1st" : number === 2 ? "2nd" : number === 3 ? "3rd" : `${number}th`;
  const zh = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"][index];
  return Object.freeze({ id: `house_${number}`, glyph: String(number), en: `${ordinal} House`, zh: `第${zh}宮` });
}));

export function parseControlledHouseWatchBank(source) {
  const entries = [...source.matchAll(/house_(\d+):\s*\{[\s\S]*?watchOut:\s*"((?:[^"\\]|\\.)*)",[\s\S]*?zhRef:\s*"((?:[^"\\]|\\.)*)"\s*\}/gu)];
  if (entries.length !== 12) throw new Error("LAB_HOUSE_WATCH_SOURCE_INVALID");
  const bank = Object.fromEntries(entries.map(([, number, encodedEn, encodedZh]) => {
    const id = `house_${number}`;
    const en = JSON.parse(`"${encodedEn}"`);
    const zh = JSON.parse(`"${encodedZh}"`).split("／").at(-1)?.trim();
    if (!HOUSE_OPTIONS.some((entry) => entry.id === id) || !en || !zh) throw new Error("LAB_HOUSE_WATCH_SOURCE_INVALID");
    return [id, Object.freeze({ en, zh })];
  }));
  if (Object.keys(bank).length !== 12) throw new Error("LAB_HOUSE_WATCH_SOURCE_INVALID");
  return Object.freeze(bank);
}

const HOUSE_WATCH_BANK = parseControlledHouseWatchBank(await readFile(interpretationBankPath, "utf8"));

const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
const option = (set, id) => set.find((entry) => entry.id === id);

export async function loadFixtures() {
  const source = await readFile(registryPath, "utf8");
  const matches = [...source.matchAll(/\{ fixture_id: "([^"]+)", authoring_id: "([^"]+)", language: "(en|zh-Hant)", exact_text: "([^"]+)" \}/g)];
  if (matches.length !== 40) throw new Error("LAB_FIXTURE_REGISTRY_INVALID");
  return Object.freeze(matches.map(([, fixture_id, authoring_id, language, question]) => Object.freeze({ fixture_id, authoring_id, language, question })));
}

export function labStatus(runtime = null) {
  const fixtureLive = typeof runtime?.fixtureGatewayFactory === "function";
  const freeTextLive = typeof runtime?.freeTextGatewayFactory === "function";
  const v05FreeTextLive = typeof runtime?.v05FreeTextGatewayFactory === "function";
  return Object.freeze({ banner: BANNER, reviewer: "founder", source_commit: process.env.LUMIS_SOURCE_COMMIT || null, window_live: fixtureLive || freeTextLive, fixture_live: fixtureLive, free_text_live: freeTextLive, v05_free_text_live: v05FreeTextLive, code: freeTextLive ? "FOUNDER_FREE_TEXT_READY" : fixtureLive ? "FOUNDER_FIXTURE_WINDOW_READY" : "DICE_AI_DISABLED", provider_calls: 0, persistence_writes: 0, units_charged: 0, prompt_version: PROMPT_VERSION, result_schema: RESULT_SCHEMA, v05_prompt_version: V05_PROMPT_VERSION, v05_result_schema: V05_RESULT_SCHEMA, contract_commit: CONTRACT_COMMIT, contract_seal_sha256: CONTRACT_SEAL, technical_evidence_sha256: runtime?.technicalEvidenceSha256 ?? null, founder_window_receipt_sha256: runtime?.receiptSha256 ?? null });
}

export function validateLabRunRequest(raw, fixtures) {
  const keys = ["fixture_id", "planet_id", "sign_id", "house_id"];
  if (!exactKeys(raw, keys) || keys.some((key) => typeof raw[key] !== "string")) return null;
  const fixture = fixtures.find((entry) => entry.fixture_id === raw.fixture_id);
  const planet = option(PLANET_OPTIONS, raw.planet_id);
  const sign = option(SIGN_OPTIONS, raw.sign_id);
  const house = option(HOUSE_OPTIONS, raw.house_id);
  return fixture && planet && sign && house ? Object.freeze({ fixture, planet, sign, house }) : null;
}

export function validateLabFreeTextRunRequest(raw) {
  const keys = ["question", "planet_id", "sign_id", "house_id"];
  if (!exactKeys(raw, keys) || keys.some((key) => typeof raw[key] !== "string")) return null;
  const planet = option(PLANET_OPTIONS, raw.planet_id);
  const sign = option(SIGN_OPTIONS, raw.sign_id);
  const house = option(HOUSE_OPTIONS, raw.house_id);
  const question = raw.question.trim();
  return planet && sign && house && question.length > 0 && [...question].length <= 280
    ? Object.freeze({ question, planet, sign, house })
    : null;
}

export function validateLabResult(raw, expectedLanguage) {
  const keys = ["schema", "language", "planet_layer", "sign_element_layer", "house_layer", "synthesis", "timing_or_pace", "judgment", "watch_out", "practical_direction"];
  if (!exactKeys(raw, keys) || raw.schema !== RESULT_SCHEMA || raw.language !== expectedLanguage) return null;
  for (const key of ["planet_layer", "sign_element_layer", "house_layer"]) if (typeof raw[key] !== "string" || !raw[key].trim() || [...raw[key]].length > 240) return null;
  if (typeof raw.synthesis !== "string" || !raw.synthesis.trim() || [...raw.synthesis].length > 900) return null;
  for (const key of ["watch_out", "practical_direction"]) if (typeof raw[key] !== "string" || !raw[key].trim() || [...raw[key]].length > 320) return null;
  if (!(raw.timing_or_pace === null || (typeof raw.timing_or_pace === "string" && raw.timing_or_pace.trim())) || !(raw.judgment === null || (typeof raw.judgment === "string" && raw.judgment.trim()))) return null;
  const joined = [raw.planet_layer, raw.sign_element_layer, raw.house_layer, raw.synthesis, raw.timing_or_pace || "", raw.judgment || "", raw.watch_out, raw.practical_direction].join(" ");
  const hasChinese = /[\u3400-\u9fff\uf900-\ufaff]/u.test(joined);
  if ((expectedLanguage === "en" && hasChinese) || (expectedLanguage === "zh-Hant" && (!hasChinese || /[嘅唔喺咁]/u.test(joined))) || [...joined].length > 1800) return null;
  return Object.freeze({ ...raw });
}

export function presentLabResult(result, selection) {
  const zh = result.language === "zh-Hant";
  const labels = zh
    ? { reading: "解讀", watch: "需要留意", practical: "實際一步" }
    : { reading: "Reading", watch: "One thing to watch", practical: "Practical step" };
  // Opening = unheaded identification line + the first synthesis sentence; the
  // Reading renders the remaining synthesis so the opening is never repeated.
  const boundary = zh ? /^[^。！？]*[。！？]/u : /^[^.!?]*[.!?]/u;
  const matched = result.synthesis.trim().match(boundary);
  const first = matched ? matched[0].trim() : result.synthesis.trim();
  const rest = matched ? result.synthesis.trim().slice(matched[0].length).trim() : "";
  const opening = zh
    ? `你抽到${selection.planet.zh}落在${selection.sign.zh}及${selection.house.zh}。${first}`
    : `You drew ${selection.planet.en} in ${selection.sign.en} in the ${selection.house.en}. ${first}`;
  const reading = rest || result.synthesis.trim();
  return Object.freeze({ kind: "reading", language: result.language, opening, sections: Object.freeze([{ heading: labels.reading, body: reading }, { heading: labels.watch, body: result.watch_out }, { heading: labels.practical, body: result.practical_direction }]) });
}

export function deterministicPresentation(code, language) {
  const kind = code === "DICE_SAFETY_REDIRECT" ? "safety" : code === "DICE_ROUTE_MISMATCH" ? "route_mismatch" : "fallback";
  const copy = kind === "safety" ? SAFETY_COPY : kind === "route_mismatch" ? ROUTE_MISMATCH_COPY : FALLBACK_COPY;
  return Object.freeze({ kind, language, message: copy[language] });
}

// ---------- v5 rendering. The edge is authoritative and injects all fixed values;
// this is a render-safety check plus per-mode presentation matching §18. ----------
export function validateLabV05Result(raw, language) {
  if (!raw || typeof raw !== "object" || raw.schema !== V05_RESULT_SCHEMA || raw.status !== "ok" || raw.language !== language) return null;
  if (!V05_MODES.includes(raw.question_mode)) return null;
  if (typeof raw.synthesis !== "string" || !raw.synthesis.trim()) return null;
  const mode = raw.question_mode;
  if (mode === "judgment") {
    if (!raw.planet_side || typeof raw.planet_side.prose !== "string" || !raw.planet_side.prose.trim()) return null;
    if (!raw.house_side || typeof raw.house_side.prose !== "string" || !raw.house_side.prose.trim()) return null;
    if (typeof raw.watch_out !== "string" || !raw.watch_out.trim()) return null;
    if (!Array.isArray(raw.suggested_followups) || raw.suggested_followups.length < 1 || raw.suggested_followups.length > 3) return null;
  } else if (mode === "timing") {
    if (typeof raw.timing_summary !== "string" || !raw.timing_summary.trim()) return null;
  } else if (mode === "location") {
    if (typeof raw.most_likely_area !== "string" || !raw.most_likely_area.trim()) return null;
    if (!Array.isArray(raw.location_candidates) || raw.location_candidates.length < 2 || raw.location_candidates.length > 4) return null;
    if (!Array.isArray(raw.location_search_order) || raw.location_search_order.length !== raw.location_candidates.length) return null;
    if (raw.location_extension !== null && (typeof raw.location_extension !== "object" || typeof raw.location_extension.relationship !== "string")) return null;
    if (typeof raw.watch_out !== "string" || !raw.watch_out.trim() || typeof raw.practical_step !== "string" || !raw.practical_step.trim()) return null;
  } else { // person / reason / thing_or_situation
    if (typeof raw.watch_out !== "string" || !raw.watch_out.trim() || typeof raw.practical_step !== "string" || !raw.practical_step.trim()) return null;
  }
  return Object.freeze({ ...raw });
}

export function presentLabV05Result(result, selection) {
  const zh = result.language === "zh-Hant";
  const lang = result.language;
  // Opening identifies the dice landing ONLY (no first-sentence extraction). The complete
  // `synthesis` stays intact under Reading; `most_likely_area` appears only in its own section.
  const opening = zh
    ? `你抽到${selection.planet.zh}落在${selection.sign.zh}及${selection.house.zh}。`
    : `You drew ${selection.planet.en} in ${selection.sign.en} in the ${selection.house.en}.`;
  const reading = result.synthesis;
  const sections = [];
  const mode = result.question_mode;
  if (mode === "judgment") {
    sections.push({ heading: V05_HEAD.result[lang], body: `${result.planet_side.prose} ${result.house_side.prose}` });
    sections.push({ heading: V05_HEAD.reading[lang], body: reading });
    sections.push({ heading: V05_HEAD.watch[lang], body: result.watch_out });
    sections.push({ heading: V05_HEAD.followups[lang], body: V05_FOLLOWUP_INTRO[lang], items: result.suggested_followups });
  } else if (mode === "timing") {
    sections.push({ heading: V05_HEAD.timing[lang], body: result.timing_summary });
    sections.push({ heading: V05_HEAD.reading[lang], body: reading });
    if (result.watch_out) sections.push({ heading: V05_HEAD.watch[lang], body: result.watch_out });
  } else if (mode === "location") {
    sections.push({ heading: V05_HEAD.area[lang], body: result.most_likely_area });
    sections.push({ heading: V05_HEAD.reading[lang], body: reading });
    // Ranked candidates in search_order. The one-step extension is rendered BESIDE the
    // candidate identified by candidate_rank (not as a generic "top candidate" section).
    const byRank = new Map(result.location_candidates.map((c) => [c.rank, c]));
    const ext = result.location_extension;
    const sep = zh ? "——相關：" : " — related: ";
    const items = result.location_search_order
      .map((r) => {
        const place = byRank.get(r)?.place;
        if (!place) return null;
        return ext && ext.candidate_rank === r ? `${place}${sep}${ext.relationship}` : place;
      })
      .filter(Boolean);
    sections.push({ heading: V05_HEAD.candidates[lang], body: "", items });
    sections.push({ heading: V05_HEAD.watch[lang], body: result.watch_out });
    sections.push({ heading: V05_HEAD.practical[lang], body: result.practical_step });
  } else {
    sections.push({ heading: V05_HEAD.reading[lang], body: reading });
    sections.push({ heading: V05_HEAD.watch[lang], body: result.watch_out });
    sections.push({ heading: V05_HEAD.practical[lang], body: result.practical_step });
  }
  return Object.freeze({ kind: "reading", language: lang, question_mode: mode, opening, sections: Object.freeze(sections) });
}

export function deterministicV05Presentation(kind, language) {
  const copy = kind === "safety" ? SAFETY_COPY : kind === "bundled" ? V05_BUNDLED_COPY : kind === "route_review" ? V05_ROUTE_REVIEW_COPY : FALLBACK_COPY;
  return Object.freeze({ kind, language, message: copy[language] });
}

export async function executeLabFreeTextV05Request(raw, { providerEnabled = false, gatewayFactory } = {}) {
  const selection = validateLabFreeTextRunRequest(raw);
  if (!selection) return Object.freeze({ status: 400, body: { code: "LAB_V05_FREE_TEXT_SELECTION_INVALID", provider_calls: 0, persistence_writes: 0, units_charged: 0 } });
  const language = /[㐀-鿿豈-﫿]/u.test(selection.question) ? "zh-Hant" : "en";
  if (!providerEnabled) return Object.freeze({ status: 503, body: { code: "DICE_AI_DISABLED", presentation: deterministicV05Presentation("fallback", language), classification: null, provider_calls: 0, persistence_writes: 0, units_charged: 0 } });
  if (typeof gatewayFactory !== "function") throw new Error("LAB_V05_GATEWAY_NOT_CONFIGURED");
  const response = await gatewayFactory().run({ question: selection.question, planet_id: selection.planet.id, sign_id: selection.sign.id, house_id: selection.house.id });
  const metadata = redactV05Metadata(response.metadata);
  if (response.kind !== "completed") {
    const kind = response.kind === "safety" ? "safety" : response.kind === "bundled" ? "bundled" : response.kind === "route_review" ? "route_review" : "fallback";
    const code = kind === "safety" ? "DICE_SAFETY_REDIRECT" : kind === "bundled" ? "DICE_BUNDLED_QUESTION" : kind === "route_review" ? "DICE_ROUTE_REVIEW_REQUIRED" : "DICE_FIXED_FALLBACK";
    return Object.freeze({ status: 200, body: { code, presentation: deterministicV05Presentation(kind, language), classification: null, metadata, provider_calls: metadata?.provider_calls ?? 0, persistence_writes: 0, units_charged: 0 } });
  }
  const result = validateLabV05Result(response.result, language);
  if (!result || !metadata || metadata.language !== language) return Object.freeze({ status: 502, body: { code: "DICE_FIXED_FALLBACK", presentation: deterministicV05Presentation("fallback", language), classification: null, metadata: null, provider_calls: 0, persistence_writes: 0, units_charged: 0 } });
  return Object.freeze({ status: 200, body: { code: "DICE_COMPLETED", presentation: presentLabV05Result(result, selection), classification: { question_mode: result.question_mode }, metadata, provider_calls: metadata.provider_calls, persistence_writes: 0, units_charged: 0 } });
}

export async function executeLabRequest(raw, { fixtures, providerEnabled = false, gatewayFactory } = {}) {
  const selection = validateLabRunRequest(raw, fixtures || []);
  if (!selection) return Object.freeze({ status: 400, body: { code: "LAB_SELECTION_INVALID", provider_calls: 0, persistence_writes: 0, units_charged: 0 } });
  if (!providerEnabled) return Object.freeze({ status: 503, body: { code: "DICE_AI_DISABLED", presentation: deterministicPresentation("DICE_FIXED_FALLBACK", selection.fixture.language), provider_calls: 0, persistence_writes: 0, units_charged: 0 } });
  if (typeof gatewayFactory !== "function") throw new Error("LAB_GATEWAY_NOT_CONFIGURED");
  const gateway = gatewayFactory();
  const response = await gateway.run({ fixture_id: selection.fixture.fixture_id, planet_id: selection.planet.id, sign_id: selection.sign.id, house_id: selection.house.id });
  if (response.kind !== "completed") {
    const code = response.kind === "safety" ? "DICE_SAFETY_REDIRECT" : response.kind === "route_mismatch" ? "DICE_ROUTE_MISMATCH" : "DICE_FIXED_FALLBACK";
    return Object.freeze({ status: 200, body: { code, presentation: deterministicPresentation(code, selection.fixture.language), metadata: null, redacted_failure_code: response.redacted_failure_code, provider_calls: 0, persistence_writes: 0, units_charged: 0 } });
  }
  const result = validateLabResult(response.result, selection.fixture.language);
  const metadata = redactLiveMetadata(response.metadata);
  if (!result || !metadata || metadata.fixture_id !== selection.fixture.fixture_id || metadata.language !== selection.fixture.language) {
    return Object.freeze({ status: 502, body: { code: "DICE_FIXED_FALLBACK", presentation: deterministicPresentation("DICE_FIXED_FALLBACK", selection.fixture.language), metadata: null, provider_calls: 0, persistence_writes: 0, units_charged: 0 } });
  }
  return Object.freeze({ status: 200, body: { code: "DICE_COMPLETED", presentation: presentLabResult(result, selection), metadata, provider_calls: 1, persistence_writes: 0, units_charged: 0 } });
}

export async function executeLabFreeTextRequest(raw, { providerEnabled = false, gatewayFactory } = {}) {
  const selection = validateLabFreeTextRunRequest(raw);
  if (!selection) return Object.freeze({ status: 400, body: { code: "LAB_FREE_TEXT_SELECTION_INVALID", provider_calls: 0, persistence_writes: 0, units_charged: 0 } });
  const language = /[\u3400-\u9fff\uf900-\ufaff]/u.test(selection.question) ? "zh-Hant" : "en";
  if (!providerEnabled) return Object.freeze({ status: 503, body: { code: "DICE_AI_DISABLED", presentation: deterministicPresentation("DICE_FIXED_FALLBACK", language), classification: null, provider_calls: 0, persistence_writes: 0, units_charged: 0 } });
  if (typeof gatewayFactory !== "function") throw new Error("LAB_FREE_TEXT_GATEWAY_NOT_CONFIGURED");
  const response = await gatewayFactory().run({ question: selection.question, planet_id: selection.planet.id, sign_id: selection.sign.id, house_id: selection.house.id });
  const classification = validateClassification(response.classification, language);
  const metadata = redactFreeTextMetadata(response.metadata);
  if (response.kind !== "completed") {
    const code = response.kind === "safety" ? "DICE_SAFETY_REDIRECT" : response.kind === "route_mismatch" ? "DICE_ROUTE_MISMATCH" : "DICE_FIXED_FALLBACK";
    return Object.freeze({ status: 200, body: { code, presentation: deterministicPresentation(code, language), classification, metadata, redacted_failure_code: response.redacted_failure_code, provider_disposition: response.provider_disposition ?? null, provider_calls: 0, persistence_writes: 0, units_charged: 0 } });
  }
  const result = validateLabResult(response.result, language);
  if (!result || !classification?.accepted || !metadata || metadata.language !== language) return Object.freeze({ status: 502, body: { code: "DICE_FIXED_FALLBACK", presentation: deterministicPresentation("DICE_FIXED_FALLBACK", language), classification: null, metadata: null, provider_calls: 0, persistence_writes: 0, units_charged: 0 } });
  return Object.freeze({ status: 200, body: { code: "DICE_COMPLETED", presentation: presentLabResult(result, selection), classification, metadata, provider_calls: 1, persistence_writes: 0, units_charged: 0 } });
}

function validateClassification(value, language) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.language !== language || typeof value.accepted !== "boolean") return null;
  if (value.accepted === false && typeof value.code === "string") return Object.freeze({ accepted: false, language, code: value.code });
  if (value.accepted === true && ["judgment", "descriptive_reflection"].includes(value.route) && typeof value.shape === "string") return Object.freeze({ accepted: true, language, route: value.route, shape: value.shape });
  return null;
}

function redactFreeTextMetadata(value) {
  const keys = ["request_mode", "language", "result_class", "attempt_count", "latency_bucket", "input_token_bucket", "output_token_bucket", "cost_bucket"];
  if (!exactKeys(value, keys) || value.request_mode !== "founder_free_text" || !["en", "zh-Hant"].includes(value.language) || !Number.isInteger(value.attempt_count)) return null;
  return Object.freeze({ ...value });
}

export function redactExportRecord(record) {
  return Object.freeze({ fixture_id: String(record.fixture_id || ""), language: String(record.language || ""), route: String(record.route || "DICE_AI_DISABLED"), latency_bucket: String(record.latency_bucket || "none"), token_bucket: String(record.token_bucket || "zero"), cost_bucket: String(record.cost_bucket || "zero"), usefulness: record.usefulness ?? "", tone: record.tone ?? "", specificity: record.specificity ?? "", length: String(record.length || ""), issue_note: String(record.issue_note || "").replace(/[\r\n,]/g, " ").slice(0, 280) });
}

function send(res, status, value) { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(value)); }
export function renderLabPage() { return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lumis Internal Dice AI Lab</title><style>
body{margin:0;background:#081425;color:#eaf1ff;font-family:ui-sans-serif,system-ui}main{max-width:980px;margin:34px auto;padding:0 20px}.notice{background:#193357;border:1px solid #4773a6;padding:13px 16px;border-radius:8px;font-weight:700}.card{background:#0f2139;border:1px solid #244563;padding:20px;border-radius:8px;margin-top:18px}h1{margin-bottom:8px}label{display:block;font-weight:700;margin:14px 0 6px}select,textarea,button{font:inherit;width:100%;box-sizing:border-box;border-radius:6px;padding:10px;border:1px solid #416786;background:#09192b;color:#f4f7ff}button{background:#6f4bd8;border:none;font-weight:800;margin-top:16px}button:disabled{opacity:.45}.mode{display:flex;gap:20px;margin:14px 0}.mode label{display:flex;align-items:center;gap:7px;margin:0}.mode input{width:auto}.hidden{display:none}textarea{min-height:92px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.meta{font-family:ui-monospace,monospace;color:#b8cbe3;white-space:pre-wrap}.muted{color:#a9b9cf;font-size:.92rem}.response{max-height:440px;overflow:auto;margin-top:16px;padding:16px;border:1px solid #416786;border-radius:8px;background:#09192b}.response h3{margin:18px 0 6px}.response p{line-height:1.55;margin:0}.response .opening{font-weight:700}@media(max-width:640px){.grid{grid-template-columns:1fr}.mode{flex-direction:column}}
</style></head><body><main><div class="notice">${BANNER}</div><h1>Internal Dice AI Lab</h1><p class="muted">Private Founder staging. Raw questions and readings stay in this browser session only.</p>
<section class="card"><div id="state" class="meta">Loading safe status…</div><div class="mode" role="radiogroup" aria-label="Question source"><label><input type="radio" name="mode" value="free_text" checked> Founder free text</label><label><input type="radio" name="mode" value="fixture"> Approved fixture regression</label></div><div id="freeTextWrap"><label for="question">Synthetic Dice question</label><textarea id="question" maxlength="280" placeholder="Enter a synthetic question without names, accounts, birth data, or customer details."></textarea><label class="mode" style="margin-top:8px"><input type="checkbox" id="v5"> Prompt v3 two-stage engine (timing · location · judgment · person · reason · thing)</label></div><div id="fixtureWrap" class="hidden"><label for="fixture">Approved synthetic question</label><select id="fixture"></select><div id="fixtureInfo" class="meta"></div></div><div class="grid"><label>Planet<select id="planet"></select></label><label>Sign<select id="sign"></select></label><label>House<select id="house"></select></label></div><button id="run" disabled>Run</button><div id="classification" class="meta"></div><div id="response" class="response" aria-live="polite"><p class="muted">Validated reading appears here.</p></div></section>
<section class="card"><h2>Private review notes</h2><p class="muted">Metadata only. Do not enter member, personal, account, credential, prompt, or response content.</p><div class="grid"><label>Usefulness 1–5<select id="usefulness"><option></option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label><label>Tone 1–5<select id="tone"><option></option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label><label>Specificity 1–5<select id="specificity"><option></option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label><label>Length<select id="length"><option></option><option>Too short</option><option>About right</option><option>Too long</option></select></label></div><label>Issue note (metadata only)<textarea id="note" maxlength="280"></textarea></label><button id="export">Download redacted CSV</button></section>
</main><script>
let status,fixtures=[],options,mode='free_text';const $=id=>document.getElementById(id);const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const optionHtml=(items,language='en')=>items.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.glyph+' '+x[language])+'</option>').join('');
async function loadJson(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('BOOTSTRAP_'+url);return r.json()}async function init(){[status,fixtures,options]=await Promise.all(['/api/status','/api/fixtures','/api/options'].map(loadJson));if(!Array.isArray(fixtures)||fixtures.length!==40||!options?.planets?.length||!options?.signs?.length||!options?.houses?.length)throw new Error('BOOTSTRAP_INVALID');$('state').textContent='free_text='+(status.free_text_live?'READY':'DISABLED')+' · fixtures='+(status.fixture_live?'READY':'DISABLED')+' · v5='+(status.v05_free_text_live?'READY':'DISABLED')+' · persistence=0 · units=0\\ncontract='+status.contract_commit+'\\nseal='+status.contract_seal_sha256+'\\nschema='+status.result_schema+'\\nv5_schema='+status.v05_result_schema;$('fixture').innerHTML=fixtures.map(f=>'<option value="'+esc(f.fixture_id)+'">'+esc(f.authoring_id+' · '+f.language+' · '+f.question)+'</option>').join('');$('planet').innerHTML=optionHtml(options.planets);$('sign').innerHTML=optionHtml(options.signs);$('house').innerHTML=optionHtml(options.houses);showFixture();setMode('free_text')}
function selectedFixture(){return fixtures.find(x=>x.fixture_id===$('fixture').value)}function showFixture(){const f=selectedFixture();$('fixtureInfo').textContent=f?'fixture_id='+f.fixture_id+' · language='+f.language:''}function setMode(value){mode=value;$('freeTextWrap').classList.toggle('hidden',mode!=='free_text');$('fixtureWrap').classList.toggle('hidden',mode!=='fixture');const ftReady=($('v5')&&$('v5').checked)?status.v05_free_text_live:status.free_text_live;$('run').disabled=mode==='free_text'?!ftReady:!status.fixture_live;latestMetadata=null;$('classification').textContent='';$('response').innerHTML='<p class="muted">Validated reading appears here.</p>'}
function renderPresentation(p){if(!p)return '<p>Request stopped safely.</p>';if(p.kind!=='reading')return '<p>'+esc(p.message)+'</p>';return '<p class="opening">'+esc(p.opening)+'</p>'+p.sections.map(s=>'<h3>'+esc(s.heading)+'</h3>'+(s.body?'<p>'+esc(s.body)+'</p>':'')+(Array.isArray(s.items)?'<ul>'+s.items.map(i=>'<li>'+esc(i)+'</li>').join('')+'</ul>':'')).join('')}
let latestMetadata=null;document.querySelectorAll('input[name="mode"]').forEach(x=>x.addEventListener('change',()=>setMode(x.value)));$('v5').addEventListener('change',()=>setMode(mode));$('fixture').addEventListener('change',()=>{latestMetadata=null;showFixture()});$('run').onclick=async()=>{latestMetadata=null;$('classification').textContent='';$('response').innerHTML='<p>Reading…</p>';const landing={planet_id:$('planet').value,sign_id:$('sign').value,house_id:$('house').value};const body=mode==='free_text'?{question:$('question').value,...landing}:{fixture_id:$('fixture').value,...landing};const endpoint=mode==='free_text'?'/api/run/free-text':'/api/run/fixture';const finalEndpoint=(mode==='free_text'&&$('v5').checked)?'/api/run/free-text-v5':endpoint;const r=await fetch(finalEndpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await r.json();latestMetadata=data.metadata||null;const c=data.classification;$('classification').textContent=c?(c.question_mode?('question_mode='+c.question_mode):(c.accepted?'route='+c.route+' · shape='+c.shape+' · language='+c.language:'stopped='+c.code+' · language='+c.language)):'';$('response').dataset.failureClass=typeof data.redacted_failure_code==='string'?data.redacted_failure_code:'';$('response').innerHTML=renderPresentation(data.presentation)};
$('export').onclick=()=>{const f=mode==='fixture'?selectedFixture():null;const row={request_mode:mode,fixture_id:f?.fixture_id||'',language:latestMetadata?.language||f?.language||'',route:latestMetadata?.result_class||status.code,latency_bucket:latestMetadata?.latency_bucket||'none',token_bucket:latestMetadata?(latestMetadata.input_token_bucket+' / '+latestMetadata.output_token_bucket):'zero',cost_bucket:latestMetadata?.cost_bucket||'zero',attempt_count:latestMetadata?.attempt_count??0,usefulness:$('usefulness').value,tone:$('tone').value,specificity:$('specificity').value,length:$('length').value,issue_note:$('note').value};const headers=Object.keys(row);const csv=headers.join(',')+'\\n'+headers.map(k=>'"'+String(row[k]).replace(/"/g,'""').replace(/[\\r\\n]/g,' ')+'"').join(',')+'\\n';const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='lumis-dice-lab-redacted-metadata.csv';a.click()};init().catch(()=>{$('state').textContent='LOCAL_LAB_STOP';$('run').disabled=true});
</script></body></html>`; }

async function readBody(req) { let body = ""; for await (const chunk of req) { body += chunk; if (body.length > 4096) throw new Error("LAB_BODY_TOO_LARGE"); } return JSON.parse(body); }
export async function createLabServer({ runtime = null } = {}) {
  const fixtures = await loadFixtures();
  return http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }); return res.end(renderLabPage()); }
    if (req.method === "GET" && url.pathname === "/api/status") return send(res, 200, labStatus(runtime));
    if (req.method === "GET" && url.pathname === "/api/fixtures") return send(res, 200, fixtures);
    if (req.method === "GET" && url.pathname === "/api/options") return send(res, 200, { planets: PLANET_OPTIONS, signs: SIGN_OPTIONS, houses: HOUSE_OPTIONS });
    if (req.method === "POST" && ["/api/run", "/api/run/fixture"].includes(url.pathname)) {
      try {
        const result = await executeLabRequest(await readBody(req), {
          fixtures,
          providerEnabled: typeof runtime?.fixtureGatewayFactory === "function",
          gatewayFactory: runtime?.fixtureGatewayFactory,
        });
        return send(res, result.status, result.body);
      } catch {
        return send(res, 400, { code: "LAB_REQUEST_INVALID", provider_calls: 0, persistence_writes: 0, units_charged: 0 });
      }
    }
    if (req.method === "POST" && url.pathname === "/api/run/free-text") {
      try {
        const result = await executeLabFreeTextRequest(await readBody(req), {
          providerEnabled: typeof runtime?.freeTextGatewayFactory === "function",
          gatewayFactory: runtime?.freeTextGatewayFactory,
        });
        return send(res, result.status, result.body);
      } catch {
        return send(res, 400, { code: "LAB_FREE_TEXT_REQUEST_INVALID", provider_calls: 0, persistence_writes: 0, units_charged: 0 });
      }
    }
    if (req.method === "POST" && url.pathname === "/api/run/free-text-v5") {
      try {
        const result = await executeLabFreeTextV05Request(await readBody(req), {
          providerEnabled: typeof runtime?.v05FreeTextGatewayFactory === "function",
          gatewayFactory: runtime?.v05FreeTextGatewayFactory,
        });
        return send(res, result.status, result.body);
      } catch {
        return send(res, 400, { code: "LAB_V05_FREE_TEXT_REQUEST_INVALID", provider_calls: 0, persistence_writes: 0, units_charged: 0 });
      }
    }
    return send(res, 404, { code: "LAB_ROUTE_NOT_FOUND" });
  });
}

async function runtimeFromEnvironment(environment = process.env) {
  const fixtureLive = environment.LUMIS_FOUNDER_DICE_FIXTURE_LIVE === "true" || environment.LUMIS_FOUNDER_DICE_LAB_LIVE === "true";
  const freeTextLive = environment.LUMIS_FOUNDER_DICE_FREE_TEXT_LIVE === "true";
  if (!fixtureLive && !freeTextLive) return null;

  const common = ["LUMIS_FOUNDER_DICE_FUNCTION_URL", "LUMIS_FOUNDER_DICE_ANON_KEY"];
  if (common.some((name) => !environment[name]?.trim())) throw new Error("LAB_LIVE_CONFIGURATION_MISSING");
  const runtime = {};

  if (fixtureLive) {
    const receiptNames = ["LUMIS_FOUNDER_DICE_TECHNICAL_EVIDENCE", "LUMIS_FOUNDER_DICE_WINDOW_REQUEST_SHA256", "LUMIS_FOUNDER_DICE_WINDOW_RECEIPT", "LUMIS_FOUNDER_DICE_PUBLIC_KEY", "LUMIS_FOUNDER_DICE_REGISTRY_SHA256", "LUMIS_FOUNDER_DICE_LAB_PACKAGE_SHA256"];
    if (receiptNames.some((name) => !environment[name]?.trim())) throw new Error("LAB_FIXTURE_CONFIGURATION_MISSING");
    await loadAcceptedTechnicalEvidence(environment.LUMIS_FOUNDER_DICE_TECHNICAL_EVIDENCE);
    const accepted = await loadFounderWindowReceipt(environment.LUMIS_FOUNDER_DICE_WINDOW_RECEIPT, environment.LUMIS_FOUNDER_DICE_PUBLIC_KEY, { registrySha256: environment.LUMIS_FOUNDER_DICE_REGISTRY_SHA256, packageSha256: environment.LUMIS_FOUNDER_DICE_LAB_PACKAGE_SHA256 });
    runtime.technicalEvidenceSha256 = "f9503a7a78817ffd92ddd48008f003af93c2deeff613de72a43618ca7542c612";
    runtime.receiptSha256 = accepted.receiptSha256;
    runtime.fixtureGatewayFactory = () => createFounderDiceGatewayClient({ functionUrl: environment.LUMIS_FOUNDER_DICE_FUNCTION_URL, anonKey: environment.LUMIS_FOUNDER_DICE_ANON_KEY, receiptEncoded: accepted.receiptEncoded, receiptSha256: accepted.receiptSha256 });
  }

  if (freeTextLive) {
    if (!environment.LUMIS_FOUNDER_DICE_FREE_TEXT_ACCESS_KEY?.trim()) throw new Error("LAB_FREE_TEXT_CONFIGURATION_MISSING");
    runtime.freeTextGatewayFactory = () => createFounderDiceFreeTextGatewayClient({ functionUrl: environment.LUMIS_FOUNDER_DICE_FUNCTION_URL, anonKey: environment.LUMIS_FOUNDER_DICE_ANON_KEY, accessKey: environment.LUMIS_FOUNDER_DICE_FREE_TEXT_ACCESS_KEY });
    // v5 (Prompt v3 technical identity) shares the same free-text access; the client
    // opts into the two-stage edge route via the x-lumis-dice-interpretation header.
    runtime.v05FreeTextGatewayFactory = () => createFounderDiceV05FreeTextGatewayClient({ functionUrl: environment.LUMIS_FOUNDER_DICE_FUNCTION_URL, anonKey: environment.LUMIS_FOUNDER_DICE_ANON_KEY, accessKey: environment.LUMIS_FOUNDER_DICE_FREE_TEXT_ACCESS_KEY });
  }
  return Object.freeze(runtime);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) { const runtime = await runtimeFromEnvironment(); const server = await createLabServer({ runtime }); server.listen(PORT, "127.0.0.1", () => console.log(`LUMIS_INTERNAL_DICE_AI_LAB_READY\nopen=http://127.0.0.1:${PORT}\nfixture_state=${typeof runtime?.fixtureGatewayFactory === "function" ? "READY" : "DISABLED"}\nfree_text_state=${typeof runtime?.freeTextGatewayFactory === "function" ? "READY" : "DISABLED"}\npersistence_writes=0\nunits_charged=0`)); }
