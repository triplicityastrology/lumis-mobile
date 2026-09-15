import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import {
  HOUSE_OPTIONS, PLANET_OPTIONS, SIGN_OPTIONS, createLabServer, deterministicPresentation, executeLabFreeTextRequest, executeLabRequest,
  labStatus, loadFixtures, parseControlledHouseWatchBank, presentLabResult, redactExportRecord, renderLabPage, validateLabFreeTextRunRequest, validateLabResult, validateLabRunRequest,
  executeLabFreeTextV05Request, presentLabV05Result, validateLabV05Result,
} from "../tools/internal-dice-ai-lab/server.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverSource = await readFile(path.join(root, "tools/internal-dice-ai-lab/server.mjs"), "utf8");
const liveWindowSource = await readFile(path.join(root, "tools/internal-dice-ai-lab/founder-live-window.mjs"), "utf8");
const liveLauncherSource = await readFile(path.join(root, "scripts/start-founder-dice-web-lab-live.sh"), "utf8");
const fixtures = await loadFixtures();
const interpretationBankSource = await readFile(path.join(root, "apps/mobile/src/features/dice/interpretationBank.ts"), "utf8");
const houseWatchBank = parseControlledHouseWatchBank(interpretationBankSource);
assert.equal(Object.keys(houseWatchBank).length, 12, "all controlled house watch-outs are sourced from the accepted interpretation bank");
assert.equal(houseWatchBank.house_6.en, "Don't let the daily grind wear you down");
assert.equal(houseWatchBank.house_12.zh, "有些事被收起，靜下來才看得見");
assert.equal(fixtures.length, 40, "closed Founder registry only");
assert.deepEqual(PLANET_OPTIONS.map(({ id }) => id), ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "north_node", "south_node"]);
assert.deepEqual(SIGN_OPTIONS.map(({ id }) => id), ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"]);
assert.deepEqual(HOUSE_OPTIONS.map(({ id }) => id), Array.from({ length: 12 }, (_, index) => `house_${index + 1}`));
assert.equal(new Set([...PLANET_OPTIONS, ...SIGN_OPTIONS, ...HOUSE_OPTIONS].map(({ id }) => id)).size, 36);

const request = { fixture_id: fixtures[0].fixture_id, planet_id: "venus", sign_id: "scorpio", house_id: "house_12" };
const selection = validateLabRunRequest(request, fixtures);
assert(selection, "exact allow-listed identifiers pass");
for (const mutation of [
  { ...request, planet_id: "chiron" }, { ...request, sign_id: "ophiuchus" }, { ...request, house_id: "house_13" },
  { ...request, fixture_id: "DICE-FOUNDER-EN-99" }, { ...request, question: "free text" },
]) assert.equal(validateLabRunRequest(mutation, fixtures), null);

let gatewayConstructions = 0;
for (const mutation of [{ ...request, planet_id: "invalid" }, { ...request, extra: true }]) {
  const stopped = await executeLabRequest(mutation, { fixtures, providerEnabled: true, gatewayFactory: () => { gatewayConstructions += 1; } });
  assert.equal(stopped.status, 400);
}
const disabled = await executeLabRequest(request, { fixtures, providerEnabled: false, gatewayFactory: () => { gatewayConstructions += 1; } });
assert.equal(disabled.status, 503);
assert.equal(disabled.body.code, "DICE_AI_DISABLED");
assert.equal(disabled.body.presentation.kind, "fallback");
assert.equal(gatewayConstructions, 0, "invalid/default-off requests construct no gateway/provider");
const classifiedFailure = await executeLabRequest(request, { fixtures, providerEnabled: true, gatewayFactory: () => ({ run: async () => ({ kind: "fallback", code: "DICE_FIXED_FALLBACK", redacted_failure_code: "DICE_PROVIDER_MALFORMED", provider_disposition: "responses_completed_schema_invalid" }) }) });
assert.equal(classifiedFailure.body.redacted_failure_code, "DICE_PROVIDER_MALFORMED", "closed provider failure survives the Lab boundary");
assert.equal(classifiedFailure.body.presentation.kind, "fallback");
assert.equal(classifiedFailure.body.metadata, null);
assert.equal(classifiedFailure.body.persistence_writes, 0);
assert.equal(classifiedFailure.body.units_charged, 0);
assert.equal(Object.hasOwn(classifiedFailure.body, "provider_disposition"), false, "protected disposition never reaches the browser failure envelope");
const live = await executeLabRequest(request, { fixtures, providerEnabled: true, gatewayFactory: () => ({ run: async (body) => {
  gatewayConstructions += 1;
  assert.deepEqual(Object.keys(body), ["fixture_id", "planet_id", "sign_id", "house_id"]);
  return { kind: "completed", result: {
    schema: "lumis_dice_v0_3_result_v3", language: "en", planet_layer: "Venus centers connection and shared value.",
    sign_element_layer: "Scorpio and Water express this through depth and privacy.", house_layer: "The 12th House places it in a hidden external environment.",
    synthesis: "On this question, Venus's pull toward closeness works through Scorpio's intensity but lands in the hidden 12th House, so the wish for connection is real while much of it stays below the surface. The value you seek is present, yet shaped by privacy and unspoken feeling rather than open exchange.",
    timing_or_pace: null, judgment: "Watch for feelings that remain unspoken.", watch_out: "Small unspoken hurts can harden into distance before either person names what changed.", practical_direction: "Name one concrete need in a calm conversation.",
  }, metadata: { fixture_id: fixtures[0].fixture_id, language: "en", result_class: "completed", attempt_count: 1, latency_bucket: "lt_12s", input_token_bucket: "lt_800", output_token_bucket: "lt_300", cost_bucket: "within_cap" }, provider_disposition: "responses_completed_valid" };
} }) });
assert.equal(live.status, 200);
assert.equal(live.body.presentation.kind, "reading");
assert.equal(live.body.persistence_writes, 0);
assert.equal(live.body.units_charged, 0);
assert.equal(Object.hasOwn(live.body, "provider_disposition"), false, "protected disposition never reaches the browser success envelope");
assert.equal(gatewayConstructions, 1);

const freeTextRequest = { question: "What should I understand about changing direction?", planet_id: "mercury", sign_id: "virgo", house_id: "house_6" };
assert(validateLabFreeTextRunRequest(freeTextRequest), "Founder free text plus closed faces passes");
for (const mutation of [
  { ...freeTextRequest, question: "" }, { ...freeTextRequest, question: " ".repeat(4) },
  { ...freeTextRequest, question: "x".repeat(281) }, { ...freeTextRequest, planet_id: "chiron" },
  { ...freeTextRequest, fixture_id: fixtures[0].fixture_id },
]) assert.equal(validateLabFreeTextRunRequest(mutation), null, "free-text boundary rejects malformed or mixed-mode input");

let freeTextConstructions = 0;
const freeTextDisabled = await executeLabFreeTextRequest(freeTextRequest, { providerEnabled: false, gatewayFactory: () => { freeTextConstructions += 1; } });
assert.equal(freeTextDisabled.status, 503);
assert.equal(freeTextConstructions, 0, "default-off free text constructs no gateway");
const freeTextLive = await executeLabFreeTextRequest(freeTextRequest, { providerEnabled: true, gatewayFactory: () => ({ run: async (body) => {
  freeTextConstructions += 1;
  assert.deepEqual(Object.keys(body), ["question", "planet_id", "sign_id", "house_id"]);
  return { kind: "completed", classification: { accepted: true, language: "en", route: "descriptive_reflection", shape: "descriptive" }, result: {
    schema: "lumis_dice_v0_3_result_v3", language: "en", planet_layer: "Mercury centers interpretation and exchange.",
    sign_element_layer: "Virgo and Earth express this through careful practical detail.", house_layer: "The 6th House places it in the external environment of routines and service.",
    synthesis: "On changing direction, Mercury's clear thinking works through Virgo's practical care and lands in the everyday 6th House of routines, so the shift is best understood through small, testable adjustments rather than one large leap. What is being asked is how your daily habits, not a single decision, will carry the change.",
    timing_or_pace: null, judgment: null, watch_out: "Over-refining the plan can become a reason to keep postponing the first real change.", practical_direction: "Choose one routine to test before making a wider change.",
  }, metadata: { request_mode: "founder_free_text", language: "en", result_class: "completed", attempt_count: 1, latency_bucket: "lt_12s", input_token_bucket: "lt_800", output_token_bucket: "lt_300", cost_bucket: "within_cap" }, provider_disposition: "responses_completed_valid" };
} }) });
assert.equal(freeTextLive.status, 200);
assert.equal(freeTextLive.body.presentation.kind, "reading");
assert.equal(freeTextLive.body.classification.route, "descriptive_reflection");
assert.equal(freeTextLive.body.presentation.sections[1].body, "Over-refining the plan can become a reason to keep postponing the first real change.", "watch-out renders the model's specific field, not a template");
assert.notEqual(freeTextLive.body.presentation.sections[1].body, "The 6th House places it in the external environment of routines and service.", "descriptive readings must not reuse the house layer as the watch-out");
assert.equal(freeTextLive.body.persistence_writes, 0);
assert.equal(freeTextLive.body.units_charged, 0);
assert.equal(freeTextConstructions, 1);

const enResult = {
  schema: "lumis_dice_v0_3_result_v3", language: "en",
  planet_layer: "Venus centers connection and shared value.", sign_element_layer: "Scorpio and Water express this through depth and privacy.",
  house_layer: "The 12th House places it in a hidden external environment.",
  synthesis: "Venus's reach for closeness works through Scorpio's intensity but lands in the hidden 12th House, so the desire for connection is genuine while much of it stays unspoken. The value is real, yet shaped by privacy rather than open exchange.",
  timing_or_pace: null,
  judgment: "Watch for feelings that remain unspoken.", watch_out: "Small unspoken hurts can harden into distance before either person names what changed.", practical_direction: "Name one concrete need in a calm conversation.",
};
const validatedEn = validateLabResult(enResult, "en");
assert(validatedEn);
const enPresentation = presentLabResult(validatedEn, selection);
assert.match(enPresentation.opening, /^You drew Venus in Scorpio in the 12th House\. /u);
assert.ok(!enPresentation.opening.includes(enPresentation.sections[0].body), "opening does not repeat the Reading");
assert.deepEqual(enPresentation.sections.map(({ heading }) => heading), ["Reading", "One thing to watch", "Practical step"]);
assert.equal(enPresentation.sections[1].body, enResult.watch_out, "watch-out renders the model field");
assert.equal(enPresentation.sections[2].body, enResult.practical_direction);

const zhResult = {
  schema: "lumis_dice_v0_3_result_v3", language: "zh-Hant",
  planet_layer: "金星把核心放在連結與共同價值。", sign_element_layer: "天蠍座與水元素以深度和私密方式表達。",
  house_layer: "第十二宮把事情放在隱藏的外在環境。",
  synthesis: "金星對親密的追求透過天蠍座的深度表達，卻落在隱藏的第十二宮，因此渴望連結是真實的，但很多都藏在表面之下。價值確實存在，只是被私密與未說出口的感受塑造，而非公開交流。",
  timing_or_pace: null,
  judgment: "需要留意未有說出口的感受。", watch_out: "細小而未說出口的委屈，可能在雙方察覺之前，已慢慢累積成距離。", practical_direction: "在平靜的對話中說出一項具體需要。",
};
const validatedZh = validateLabResult(zhResult, "zh-Hant");
assert(validatedZh);
const zhPresentation = presentLabResult(validatedZh, selection);
assert.match(zhPresentation.opening, /^你抽到金星落在天蠍座及第十二宮。/u);
assert.deepEqual(zhPresentation.sections.map(({ heading }) => heading), ["解讀", "需要留意", "實際一步"]);
assert.equal(zhPresentation.sections[1].body, zhResult.watch_out, "zh watch-out renders the model field");

assert.equal(validateLabResult({ ...enResult, diagnostic: true }, "en"), null, "unknown result fields rejected");
assert.equal(validateLabResult({ ...enResult, language: "zh-Hant" }, "en"), null, "language drift rejected");
assert.equal(validateLabResult({ ...zhResult, practical_direction: "呢個做法唔得" }, "zh-Hant"), null, "colloquial/malformed zh-Hant rejected");
assert.deepEqual(Object.keys(deterministicPresentation("DICE_SAFETY_REDIRECT", "en")), ["kind", "language", "message"]);
assert.equal(deterministicPresentation("DICE_SAFETY_REDIRECT", "en").message, "Lumis can’t help with that request, but it can offer a safer, general reflection instead.");
assert.equal(deterministicPresentation("DICE_FIXED_FALLBACK", "en").message, "Lumis couldn’t complete that reflection just now. Please try again.");
assert.match(liveWindowSource, /receiptEncoded: bytes\.toString\("base64url"\)/u, "gateway must transmit the exact verified receipt bytes");
assert.doesNotMatch(liveWindowSource, /Buffer\.from\(JSON\.stringify\(receipt\)/u, "gateway must not reserialize signed receipt bytes");
assert.match(liveWindowSource, /AbortSignal\.timeout\(14_000\)/u, "local transport keeps a response-only margin above the server-owned 12-second deadline");

assert.equal(labStatus().contract_commit, "c1ec632fdea1f2677621f8b1bd3a71e72d17f071");
assert.equal(labStatus().contract_seal_sha256, "d0f0c631aa40cf076d86d0a661fe289466d23593bb117c4a359b7ba46e7c007c");
assert.equal(labStatus().window_live, false);
assert.equal(labStatus().provider_calls, 0);
const redacted = redactExportRecord({ fixture_id: fixtures[0].fixture_id, language: "en", route: "DICE_AI_DISABLED", question: fixtures[0].question, response: enResult, prompt: "not exportable", latency_bucket: "none", token_bucket: "zero", cost_bucket: "zero" });
assert.deepEqual(Object.keys(redacted).filter((key) => /question|prompt|response|secret|credential/i.test(key)), [], "CSV is metadata-only");
assert.doesNotMatch(serverSource, /openai\.azure\.com|services\.ai\.azure\.com|@supabase|chat-message|normal.?chat/i, "no provider, Supabase, or normal-chat route");
assert.doesNotMatch(serverSource, /contenteditable|localStorage|sessionStorage|console\.log\([^`]*response/iu, "raw response is not persisted or logged");
assert.match(serverSource, /value="free_text"/u, "Founder free-text mode is explicit");
assert.match(serverSource, /value="fixture"/u, "approved fixture mode is explicit and mutually exclusive");
assert.match(serverSource, /endpoint=mode==='free_text'\?'\/api\/run\/free-text':'\/api\/run\/fixture'/u, "browser routes each mode to its closed endpoint");
assert.match(serverSource, /body:JSON\.stringify\(body\)/u, "browser sends only the selected-mode body");
assert.doesNotMatch(serverSource, /result[^\n]*JSON\.stringify|JSON\.stringify\(await r\.json/u, "diagnostic JSON is not the main response");
assert.match(serverSource, /LUMIS_FOUNDER_DICE_WINDOW_RECEIPT/u, "live mode requires a separate Founder receipt");
assert.match(serverSource, /latestMetadata=data\.metadata\|\|null/u, "only redacted metadata is retained for export");
assert.match(serverSource, /dataset\.failureClass/u, "closed failure class remains session-only for diagnosis");
assert.doesNotMatch(serverSource, /redacted_failure_code[^\n]*row=|redacted_failure_code[^\n]*csv/iu, "failure class is not exported");
assert.match(liveLauncherSource, /LUMIS_FOUNDER_DICE_FREE_TEXT_LIVE/u, "live launcher has an independent free-text switch");
assert.match(liveLauncherSource, /STOP_LAB_FREE_TEXT_ACCESS_UNAVAILABLE/u, "free-text live mode requires its server-held access boundary");
assert.match(liveLauncherSource, /if \[\[ "\$FIXTURE_LIVE" == "true" \]\]/u, "fixture receipts are required only for fixture mode");
const generatedScript = renderLabPage().match(/<script>([\s\S]*)<\/script>/u)?.[1];
assert(generatedScript, "generated Lab page contains its bootstrap script");
assert.doesNotThrow(() => new vm.Script(generatedScript), "generated inline JavaScript parses before bootstrap");
const labServer = await createLabServer();
await new Promise((resolve) => labServer.listen(0, "127.0.0.1", resolve));
const labAddress = labServer.address();
const labBase = `http://127.0.0.1:${labAddress.port}`;
const [pageResponse, statusResponse, fixtureResponse, optionResponse] = await Promise.all([
  fetch(labBase), fetch(`${labBase}/api/status`), fetch(`${labBase}/api/fixtures`), fetch(`${labBase}/api/options`),
]);
assert.equal(pageResponse.status, 200);
assert.equal(statusResponse.status, 200);
assert.equal((await fixtureResponse.json()).length, 40);
assert.deepEqual(Object.fromEntries(Object.entries(await optionResponse.json()).map(([key, value]) => [key, value.length])), { planets: 12, signs: 12, houses: 12 });
const stoppedFreeText = await fetch(`${labBase}/api/run/free-text`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(freeTextRequest) });
assert.equal(stoppedFreeText.status, 503, "default-off HTTP free-text route is present and fail closed");
await new Promise((resolve, reject) => labServer.close((error) => error ? reject(error) : resolve()));
assert.equal(deterministicPresentation("DICE_ROUTE_MISMATCH", "en").message, "Lumis couldn’t confirm the correct reading type for this question, so no interpretation was generated. Please rephrase the question clearly and try again.");
assert.notEqual(deterministicPresentation("DICE_ROUTE_MISMATCH", "en").message, deterministicPresentation("DICE_FIXED_FALLBACK", "en").message, "route-mismatch copy is distinct from technical fallback");

// ---- v5 (Prompt v3 technical identity) lab path ----
const v05Judgment = { schema: "lumis_dice_interpretation_v5", status: "ok", language: "en", question_mode: "judgment",
  planet_side: { fortune: "major_benefic", fortune_zh: "大吉星", dignity: "ruler", dignity_zh: "守護（最強）", strength: "strong", constructive_traits: "Generous, trustworthy, honest, principled, wise, capable and resourceful", difficult_traits: "Wasteful, reckless, indulgent, exaggerating, greedy and careless", dignity_emphasis: "constructive", prose: "Jupiter is a major benefic at full strength here." },
  house_side: { fortune: "great_fortune", fortune_zh: "大吉", rank: 1, prose: "House 1 is the most supportive setting, with the matter in your hands." },
  most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
  synthesis: "Both fixed sides are favourable and remain separate. A strong major benefic sits inside the most supportive house.",
  timing_summary: null, watch_out: "Keep optimism realistic even with strong support.", practical_step: null, suggested_followups: ["What most needs preparing first?"] };
// The Web boundary now validates copy with the AUTHORITATIVE compiled module. Build the mocked
// success copy AS the deterministic assembly of the canonical, so it passes that validation.
const CP = await import(pathToFileURL(path.join(root, ".tmp/dice-v0-5-tests/supabase/functions/_shared/dice-v0-5-customer-copy.js")).href);
const v05Deterministic = CP.deterministicCustomerCopy(v05Judgment);
const v05Meta = (over = {}) => ({ request_mode: "founder_free_text", language: "en", question_mode: "judgment", result_class: "completed", provider_calls: 2, astrology_provider_calls: 2, copy_provider_calls: 0, copy_source: "deterministic", latency_bucket: "lt_12s", cost_bucket: "within_cap", units_consumed: 0, persistence_writes: 0, ...over });
const v05FreeText = { question: "Should I accept this promotion?", planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" };
const v05Gateway = (resp) => ({ providerEnabled: true, gatewayFactory: () => ({ run: async () => resp }) });
assert.equal((await executeLabFreeTextV05Request(v05FreeText, { providerEnabled: false })).status, 503, "v5 default-off returns disabled");
// Deterministic success: DICE_COMPLETED, copy_source from metadata, follow-ups preserved from canonical.
const v05Ok = await executeLabFreeTextV05Request(v05FreeText, v05Gateway({ kind: "completed", result: v05Judgment, question_mode: "judgment", customer_copy: v05Deterministic, metadata: v05Meta() }));
assert.equal(v05Ok.status, 200);
assert.equal(v05Ok.body.code, "DICE_COMPLETED");
assert.equal(v05Ok.body.classification.copy_source, "deterministic", "web lab reports copy_source FROM METADATA");
assert.equal(v05Ok.body.provider_calls, 2, "deterministic success reports two provider calls (Stage 1 + Stage 2)");
assert.deepEqual(v05Ok.body.presentation.sections.map((s) => s.heading), ["Short answer", "Why", "Watch out", "Follow-up questions"], "judgment renders the §12 sections");
assert.deepEqual(v05Ok.body.presentation.sections[3].items, v05Deterministic.suggested_followups, "follow-ups render exactly the canonical sequence");
assert.equal(v05Ok.body.presentation.opening, "You drew Jupiter in Sagittarius in the 1st House.", "opening stays landing-only");
// ---- F07: a successful Stage-3 Web reading through the REAL customer-copy handler (NOT
// presentLabV05Result), in BOTH languages. English success is v05Ok above; here is a zh-Hant throw. ----
const zhJudgment = { schema: "lumis_dice_interpretation_v5", status: "ok", language: "zh-Hant", question_mode: "judgment",
  planet_side: { fortune: "major_benefic", fortune_zh: "大吉星", dignity: "ruler", dignity_zh: "守護（最強）", strength: "strong", constructive_traits: "慷慨、可靠、有智慧", difficult_traits: "浪費、魯莽、誇大", dignity_emphasis: "constructive", prose: "木星在這裡運作得順暢而有力，帶來明顯的助力。" },
  house_side: { fortune: "great_fortune", fortune_zh: "大吉", rank: 1, prose: "第一宮是最有利的位置，事情由你自己主導。" },
  most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
  synthesis: "兩邊都有利，而且各自獨立；強勢的助力落在最有支持的位置。", timing_summary: null,
  watch_out: "即使有強力支持，也要保持務實的樂觀。", practical_step: null, suggested_followups: ["我應該先準備甚麼？"] };
const zhMeta = { request_mode: "founder_free_text", language: "zh-Hant", question_mode: "judgment", result_class: "completed", provider_calls: 2, astrology_provider_calls: 2, copy_provider_calls: 0, copy_source: "deterministic", latency_bucket: "unmeasured", cost_bucket: "policy_within_cap", units_consumed: 0, persistence_writes: 0 };
const zhOk = await executeLabFreeTextV05Request({ question: "我應唔應該接受呢個升職？", planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" }, v05Gateway({ kind: "completed", result: zhJudgment, question_mode: "judgment", customer_copy: CP.deterministicCustomerCopy(zhJudgment), metadata: zhMeta }));
assert.equal(zhOk.body.code, "DICE_COMPLETED", "F07: zh-Hant Stage-3 Web reading completes through the real handler");
assert.equal(zhOk.body.classification.copy_source, "deterministic", "F07: zh-Hant success reports deterministic");
assert.ok(JSON.stringify(zhOk.body.presentation).includes("兩邊都有利"), "F07: zh-Hant reading renders the Chinese canonical synthesis");
assert.ok(JSON.stringify(zhOk.body.presentation.sections).includes("木星"), "F07: zh-Hant reading renders the Chinese Planet-side factor");
// ---- F01 Web PROVENANCE MATRIX (P01–P04): under the deterministic default the Web REGENERATES the
// displayed copy from the validated canonical, so a supplied headline/reading/step/follow-up
// substitution — contrary, partial or malformed — has NO effect on what the customer sees. The
// result is a DICE_COMPLETED reading whose sections are byte-identical to the clean canonical
// display, and the reported copy_source is "deterministic" (the actual path). No contrary text.
const v05OkSections = JSON.stringify(v05Ok.body.presentation.sections);
for (const [label, mutate] of [
  ["extra-key", (c) => ({ ...c, extra: "x" })],
  ["judgment-practical", (c) => ({ ...c, practical_step: "Take a new action." })],
  ["judgment-no-warning", (c) => ({ ...c, watch_out: null })],
  ["judgment-zero-followups", (c) => ({ ...c, suggested_followups: [] })],
  ["followups-replaced (P02-adjacent)", (c) => ({ ...c, suggested_followups: ["Should I quit my job?"] })],
  ["over-headline", (c) => ({ ...c, headline: "a".repeat(200) + "." })],
  ["prohibited-reading (P01)", (c) => ({ ...c, reading: "This sits on rank 7 of the houses." })],
  ["reversed-conclusion (P01)", (c) => ({ ...c, headline: "Both factors strongly oppose proceeding.", reading: "Everything here is unfavourable. Do not proceed." })],
  ["dropped-synthesis (P02)", (c) => ({ ...c, reading: String(v05Judgment.planet_side.prose) + "\n\n" + String(v05Judgment.house_side.prose) })],
]) {
  const bad = mutate(v05Deterministic);
  const res = await executeLabFreeTextV05Request(v05FreeText, v05Gateway({ kind: "completed", result: v05Judgment, question_mode: "judgment", customer_copy: bad, metadata: v05Meta() }));
  assert.equal(res.body.code, "DICE_COMPLETED", `F01 deterministic still renders the canonical reading: ${label}`);
  assert.equal(res.body.classification.copy_source, "deterministic", `F01 ${label}: reported source is the actual (deterministic) path`);
  assert.equal(JSON.stringify(res.body.presentation.sections), v05OkSections, `F01 ${label}: displayed copy is the regenerated canonical; the injected supplied copy has NO effect`);
}
// F03 (P12/P13): a broken source-prose COMPONENT (Planet prose, House prose or synthesis) is caught
// by canonicalProseComplete BEFORE the components are joined — a valid final synthesis cannot conceal
// an earlier fragment — so the reading is controlled-unavailable, never a customer reading containing
// the broken paragraph. Tested with and without terminal punctuation.
const jPlanet = (prose) => ({ ...v05Judgment, planet_side: { ...v05Judgment.planet_side, prose } });
const jHouse = (prose) => ({ ...v05Judgment, house_side: { ...v05Judgment.house_side, prose } });
for (const [label, brokenCanonical] of [
  ["P12 planet-prose fragment (with period)", jPlanet("They tend to be careful and.")],
  ["P12 planet-prose fragment (no period)", jPlanet("They tend to be careful and")],
  ["P13 house-prose fragment (with period)", jHouse("Beware of overex.")],
  ["P13 house-prose fragment (no period)", jHouse("Beware of overex")],
  ["synthesis fragment", { ...v05Judgment, synthesis: "A strong benefic sits inside the house because" }],
]) {
  const res = await executeLabFreeTextV05Request(v05FreeText, v05Gateway({ kind: "completed", result: brokenCanonical, question_mode: "judgment", customer_copy: CP.deterministicCustomerCopy(brokenCanonical), metadata: v05Meta() }));
  assert.equal(res.body.code, "DICE_COPY_UNAVAILABLE", `F03 broken component → controlled unavailable: ${label}`);
  assert.ok(!("sections" in res.body.presentation), `F03 ${label}: no reading sections shown`);
}
// F02 (P05–P11, P21): the authoritative final-result validator AND the full Location projection guard
// run at the Web boundary. Each invariant is exercised IN ISOLATION on an otherwise-valid baseline;
// every failure returns the controlled DICE_FIXED_FALLBACK with the measured provider total preserved.
const v05LocBase = { schema: "lumis_dice_interpretation_v5", status: "ok", language: "en", question_mode: "location", planet_side: null, house_side: null,
  most_likely_area: "at home", location_candidates: [
    { rank: 1, place: "the bedroom", evidence: { planet_ids: ["planet.moon.related.1"], house_ids: [], element_ids: [] } },
    { rank: 2, place: "the kitchen", evidence: { planet_ids: ["planet.moon.related.2"], house_ids: [], element_ids: [] } }],
  location_extension: { candidate_rank: 1, source_id: "planet.moon.related.1", relationship: "A document pouch is a direct container for a passport." }, location_search_order: [1, 2],
  synthesis: "Start at home, then narrower spots.", timing_summary: null, watch_out: "Do not check only the obvious spots.", practical_step: "Begin with the bedroom.", suggested_followups: [] };
const locMut = (over) => ({ ...v05LocBase, ...over });
const cand = (over) => [{ ...v05LocBase.location_candidates[0], ...over }, v05LocBase.location_candidates[1]];
const v05LocSel = { question: "Where is my passport?", planet_id: "moon", sign_id: "leo", house_id: "house_4" };
const locMeta = () => v05Meta({ question_mode: "location", language: "en" });
for (const [label, badCanonical, sel, meta] of [
  ["P05 numeric planet evidence id", locMut({ location_candidates: cand({ evidence: { planet_ids: [99], house_ids: [], element_ids: [] } }) }), v05LocSel, locMeta()],
  ["P06 extension missing source_id", locMut({ location_extension: { candidate_rank: 1, relationship: "x is a direct container for a passport." } }), v05LocSel, locMeta()],
  ["P07 negative ranks and order", locMut({ location_candidates: [{ ...v05LocBase.location_candidates[0], rank: -1 }, { ...v05LocBase.location_candidates[1], rank: -2 }], location_search_order: [-1, -2], location_extension: null }), v05LocSel, locMeta()],
  ["P08 extension source not cited", locMut({ location_extension: { candidate_rank: 1, source_id: "planet.moon.related.9", relationship: "A pouch is a direct container for a passport." } }), v05LocSel, locMeta()],
  ["P09 rank-1 has no evidence", locMut({ location_candidates: cand({ evidence: { planet_ids: [], house_ids: [], element_ids: [] } }), location_extension: null }), v05LocSel, locMeta()],
  ["P10 Chinese place in English list", locMut({ location_candidates: cand({ place: "睡房" }), location_extension: null }), v05LocSel, locMeta()],
  ["P11 invalid Judgment dignity enum", { ...v05Judgment, planet_side: { ...v05Judgment.planet_side, dignity: "sovereign" } }, v05FreeText, v05Meta()],
  ["P21 metadata mode contradicts result", v05Judgment, v05FreeText, v05Meta({ question_mode: "timing" })],
]) {
  const res = await executeLabFreeTextV05Request(sel, v05Gateway({ kind: "completed", result: badCanonical, question_mode: badCanonical.question_mode, customer_copy: CP.deterministicCustomerCopy(v05LocBase), metadata: meta }));
  assert.equal(res.body.code, "DICE_FIXED_FALLBACK", `F02 authoritative canonical rejection: ${label}`);
  assert.ok(!("sections" in res.body.presentation), `F02 ${label}: no sections shown`);
  assert.equal(res.body.provider_calls, meta.provider_calls, `F02 ${label}: measured provider total preserved`);
  assert.equal(res.body.provider_calls_disposition, "measured", `F02 ${label}: total is measured, not a false 0`);
}
// F01 Level-1 editor gating: the gated language editor is honoured ONLY under the trusted server flag,
// ONLY for the Level-1 family, and ONLY when the trusted metadata declares copy_source "stage3".
const v05Level1 = { schema: "lumis_dice_interpretation_v5", status: "ok", language: "en", question_mode: "person",
  planet_side: null, house_side: null, most_likely_area: null, location_candidates: null, location_extension: null, location_search_order: null,
  synthesis: "This points to someone practical and steady who prefers clear commitments.", timing_summary: null,
  watch_out: "Do not read more certainty into this than the symbols support.", practical_step: "Focus on how they act, not only what they say.", suggested_followups: [] };
const v05Level1Base = CP.deterministicCustomerCopy(v05Level1);
const v05Level1Editor = { ...v05Level1Base, headline: "A steady, practical person.", reading: "The symbols point to someone grounded who values clear commitments and consistent follow-through." };
const v05Level1Sel = { question: "What is this person like?", planet_id: "saturn", sign_id: "capricorn", house_id: "house_7" };
const stage3Meta = v05Meta({ question_mode: "person", provider_calls: 3, astrology_provider_calls: 2, copy_provider_calls: 1, copy_source: "stage3" });
// Editor DISABLED (default): supplied stage3 editor prose is NOT displayed — the Web regenerates the
// deterministic Level-1 copy and reports copy_source "deterministic".
const v05Level1Off = await executeLabFreeTextV05Request(v05Level1Sel, v05Gateway({ kind: "completed", result: v05Level1, question_mode: "person", customer_copy: v05Level1Editor, metadata: stage3Meta }));
assert.equal(v05Level1Off.body.code, "DICE_COMPLETED", "Level-1 editor OFF still renders a reading");
assert.equal(v05Level1Off.body.classification.copy_source, "deterministic", "Level-1 editor OFF: label 'stage3' does NOT enable the editor");
{
  const shown = JSON.stringify(v05Level1Off.body.presentation);
  assert.ok(!shown.includes("A steady, practical person"), "Level-1 editor OFF: the supplied editor headline is not shown");
  assert.ok(shown.includes("someone practical and steady who prefers clear commitments"), "Level-1 editor OFF: the deterministic canonical reading is shown");
}
// Editor ENABLED for the Level-1 family + trusted stage3 label: the merged copy passes the SAME
// authoritative validation and is displayed as copy_source "stage3".
const v05Level1On = await executeLabFreeTextV05Request(v05Level1Sel, { ...v05Gateway({ kind: "completed", result: v05Level1, question_mode: "person", customer_copy: v05Level1Editor, metadata: stage3Meta }), level1EditorEnabled: true });
assert.equal(v05Level1On.body.code, "DICE_COMPLETED", "Level-1 editor ON renders a reading");
assert.equal(v05Level1On.body.classification.copy_source, "stage3", "Level-1 editor ON: validated editor prose is reported as stage3");
// Editor ENABLED but the supplied editor prose is malformed (prohibited term) → controlled unavailable,
// never displayed.
const v05Level1Bad = { ...v05Level1Editor, reading: "This person sits on rank 7 of the houses." };
const v05Level1BadRes = await executeLabFreeTextV05Request(v05Level1Sel, { ...v05Gateway({ kind: "completed", result: v05Level1, question_mode: "person", customer_copy: v05Level1Bad, metadata: stage3Meta }), level1EditorEnabled: true });
assert.equal(v05Level1BadRes.body.code, "DICE_COPY_UNAVAILABLE", "Level-1 editor ON rejects malformed editor prose");
assert.ok(!("sections" in v05Level1BadRes.body.presentation), "Level-1 editor ON malformed: no sections shown");
// Editor ENABLED but a CONCLUSION-BEARING mode still stays deterministic (the editor cannot touch it).
const v05JudgeEditorAttempt = { ...v05Deterministic, headline: "Both factors strongly oppose proceeding." };
const v05JudgeStage3 = await executeLabFreeTextV05Request(v05FreeText, { ...v05Gateway({ kind: "completed", result: v05Judgment, question_mode: "judgment", customer_copy: v05JudgeEditorAttempt, metadata: v05Meta({ provider_calls: 3, astrology_provider_calls: 2, copy_provider_calls: 1, copy_source: "stage3" }) }), level1EditorEnabled: true });
assert.equal(v05JudgeStage3.body.code, "DICE_COMPLETED", "Judgment under editor-ON still renders");
assert.equal(v05JudgeStage3.body.classification.copy_source, "deterministic", "Judgment stays deterministic even with the editor enabled (conclusion-bearing)");
assert.equal(JSON.stringify(v05JudgeStage3.body.presentation.sections), v05OkSections, "Judgment editor attempt has NO effect on the displayed conclusion");
// S01 Web: a substituted Location search step never reaches the customer (canonical step rendered).
const v05Loc = { schema: "lumis_dice_interpretation_v5", status: "ok", language: "en", question_mode: "location", planet_side: null, house_side: null,
  most_likely_area: "A quiet place at home.", location_candidates: [{ rank: 1, place: "the bedroom", evidence: { planet_ids: ["p"], house_ids: [], element_ids: [] } }, { rank: 2, place: "the kitchen", evidence: { planet_ids: [], house_ids: ["h"], element_ids: [] } }],
  location_extension: null, location_search_order: [1, 2], synthesis: "Look in a private domestic setting.", timing_summary: null,
  watch_out: "Do not assume it is permanently lost.", practical_step: "Search the bedroom first.", suggested_followups: [] };
const v05LocCopy = { ...CP.deterministicCustomerCopy(v05Loc), practical_step: "Go to the airport first." };
const v05LocRes = await executeLabFreeTextV05Request({ question: "Where is my passport?", planet_id: "moon", sign_id: "leo", house_id: "house_4" }, v05Gateway({ kind: "completed", result: v05Loc, question_mode: "location", customer_copy: v05LocCopy, metadata: v05Meta({ question_mode: "location", language: "en" }) }));
// P04/S01: the substituted airport step is IGNORED — the Web regenerates the Location copy from the
// validated canonical, so the customer sees the canonical bedroom step and never the airport step.
assert.equal(v05LocRes.body.code, "DICE_COMPLETED", "S01 renders the canonical Location reading");
assert.equal(v05LocRes.body.classification.copy_source, "deterministic", "S01 reports the actual deterministic path");
{
  const shown = JSON.stringify(v05LocRes.body.presentation);
  assert.ok(!/airport/i.test(shown), "S01: the substituted airport step never reaches the customer");
  assert.ok(shown.includes("Search the bedroom first"), "S01: the canonical bedroom step is shown");
}
// S03 malformed Location projection ([1,1] + leaked term) → rejected before any render.
const v05BadLoc = { ...v05Loc, location_search_order: [1, 1], location_candidates: [{ ...v05Loc.location_candidates[0], place: "planet_speed internal clue" }, v05Loc.location_candidates[1]] };
const v05BadLocRes = await executeLabFreeTextV05Request({ question: "Where is my passport?", planet_id: "moon", sign_id: "leo", house_id: "house_4" }, v05Gateway({ kind: "completed", result: v05BadLoc, question_mode: "location", customer_copy: CP.deterministicCustomerCopy(v05Loc), metadata: v05Meta({ question_mode: "location", language: "en" }) }));
assert.equal(v05BadLocRes.body.code, "DICE_FIXED_FALLBACK", "S03 malformed Location projection rejected");
assert.ok(!("sections" in v05BadLocRes.body.presentation), "S03 malformed Location shows no candidate sections");
// Copy unavailable transport: null copy + copy_source "unavailable" → fixed message, no sections.
const v05Unavailable = await executeLabFreeTextV05Request(v05FreeText, v05Gateway({ kind: "completed", result: v05Judgment, question_mode: "judgment", customer_copy: null, metadata: v05Meta({ copy_source: "unavailable" }) }));
assert.equal(v05Unavailable.body.code, "DICE_COPY_UNAVAILABLE", "copy-unavailable is not a successful reading");
assert.equal(v05Unavailable.body.presentation.kind, "copy_unavailable");
assert.ok(!("sections" in v05Unavailable.body.presentation), "unavailable shows a fixed message, not canonical sections");
// F01: an absent copy_source label CANNOT enable a supplied copy. The Web does not trust the label
// (present, absent or otherwise) — it regenerates deterministically from the validated canonical and
// reports the actual path ("deterministic"). The supplied copy is never displayed on its say-so.
const v05NoSource = await executeLabFreeTextV05Request(v05FreeText, v05Gateway({ kind: "completed", result: v05Judgment, question_mode: "judgment", customer_copy: { ...v05Deterministic, headline: "Both factors strongly oppose proceeding." }, metadata: { request_mode: "founder_free_text", language: "en", question_mode: "judgment", result_class: "completed", provider_calls: 2, latency_bucket: "lt_12s", cost_bucket: "within_cap", units_consumed: 0, persistence_writes: 0 } }));
assert.equal(v05NoSource.body.code, "DICE_COMPLETED", "missing copy_source still renders the regenerated canonical reading");
assert.equal(v05NoSource.body.classification.copy_source, "deterministic", "missing copy_source: the Web reports the actual regenerated path, never trusts a label");
assert.equal(JSON.stringify(v05NoSource.body.presentation.sections), v05OkSections, "missing copy_source: injected contrary headline has NO effect on the display");
// D05 honest totals: metadata valid but canonical malformed → PRESERVE provider_calls, disposition measured.
const v05D05 = await executeLabFreeTextV05Request(v05FreeText, v05Gateway({ kind: "completed", result: { ...v05Judgment, synthesis: null }, question_mode: "judgment", customer_copy: v05Deterministic, metadata: v05Meta({ provider_calls: 3, copy_provider_calls: 1, copy_source: "stage3" }) }));
assert.equal(v05D05.body.code, "DICE_FIXED_FALLBACK", "D05 malformed canonical → failure code");
assert.equal(v05D05.body.provider_calls, 3, "D05 preserves the real provider-call total on presentation failure");
assert.equal(v05D05.body.provider_calls_disposition, "measured", "D05 marks the total as measured, not a false 0");
const v05Review = await executeLabFreeTextV05Request(v05FreeText, { providerEnabled: true, gatewayFactory: () => ({ run: async () => ({ kind: "route_review", code: "DICE_ROUTE_REVIEW_REQUIRED", metadata: null }) }) });
assert.equal(v05Review.body.code, "DICE_ROUTE_REVIEW_REQUIRED");
assert.equal(v05Review.body.presentation.kind, "route_review");
// Test 6 (§20 workbook) — the EXACT bundled question driven through the REAL v5 Stage-0 gate
// (the compiled window), NOT a manually forced bundled outcome. The provider adapter is a call
// counter that must never be invoked; the lab then renders the specific bundled member copy.
const windowMod = await import(pathToFileURL(path.join(root, ".tmp/dice-v0-5-tests/supabase/functions/_shared/dice-v0-5-window.js")).href);
const executeDiceV05FreeTextCase = windowMod.executeDiceV05FreeTextCase ?? windowMod.default?.executeDiceV05FreeTextCase;
const parseDiceV05FreeTextRequest = windowMod.parseDiceV05FreeTextRequest ?? windowMod.default?.parseDiceV05FreeTextRequest;
assert.ok(typeof executeDiceV05FreeTextCase === "function" && typeof parseDiceV05FreeTextRequest === "function",
  "compiled v5 window available (test:dice-v05-web-lab compiles it first)");
const TEST6_QUESTION = "我個application會唔會批？幾時會批？"; // will it be approved? when will it be approved?
let test6AdapterCalls = 0;
const realGateGateway = () => ({ run: async (body) => {
  const req = parseDiceV05FreeTextRequest(body);
  return executeDiceV05FreeTextCase(req, { invoke: async () => { test6AdapterCalls += 1; return { kind: "network" }; } }, () => 1000);
} });
const v05Bundled = await executeLabFreeTextV05Request({ question: TEST6_QUESTION, planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" }, { providerEnabled: true, gatewayFactory: realGateGateway });
assert.equal(test6AdapterCalls, 0, "Test 6: the real Stage-0 gate made ZERO provider calls (adapter never invoked)");
assert.equal(v05Bundled.body.provider_calls, 0, "Test 6: lab reports 0 provider calls");
assert.equal(v05Bundled.body.code, "DICE_BUNDLED_QUESTION", "Test 6 bundled code (from the real gate)");
assert.equal(v05Bundled.body.presentation.message, "這裡包含多於一個問題。每次擲骰只適用於一個清晰問題，請選擇其中一個問題後再試。", "Test 6 exact bundled member copy (zh, driven by the real gate)");
const v05Timing = { ...v05Judgment, question_mode: "timing", planet_side: null, house_side: null, synthesis: "Slow by nature but externally assisted, so gradual overall. The house lifts an otherwise slow pace.", timing_summary: "Slow by nature but externally assisted, gradual overall.", watch_out: "Do not expect a sudden jump.", practical_step: null, suggested_followups: [] };
const v05TimingPresentation = presentLabV05Result(validateLabV05Result(v05Timing, "en"), { planet: { en: "Pluto", zh: "冥王星", id: "pluto" }, sign: { en: "Sagittarius", zh: "人馬座", id: "sagittarius" }, house: { en: "1st House", zh: "第一宮", id: "house_1" } });
assert.deepEqual(v05TimingPresentation.sections.map((s) => s.heading), ["Timing", "Reading", "One thing to watch"], "timing renders Timing + Reading + Watch, no Practical step");
const v05Location = { schema: "lumis_dice_interpretation_v5", status: "ok", language: "en", question_mode: "location", planet_side: null, house_side: null,
  most_likely_area: "at home", location_candidates: [{ rank: 1, place: "the bedroom", evidence: { planet_ids: ["planet.moon.related.1"], house_ids: [], element_ids: [] } }, { rank: 2, place: "the kitchen", evidence: { planet_ids: ["planet.moon.related.2"], house_ids: [], element_ids: [] } }],
  location_extension: { candidate_rank: 1, source_id: "planet.moon.related.1", relationship: "A document pouch is a direct container for a passport." }, location_search_order: [1, 2],
  synthesis: "Start at home, then narrower spots. The heat side comes next.", timing_summary: null, watch_out: "Don't check only the obvious spots.", practical_step: "Begin with the bedroom.", suggested_followups: [] };
const v05LocationPresentation = presentLabV05Result(validateLabV05Result(v05Location, "en"), { planet: { en: "Moon", zh: "月亮", id: "moon" }, sign: { en: "Leo", zh: "獅子座", id: "leo" }, house: { en: "4th House", zh: "第四宮", id: "house_4" } });
assert.deepEqual(v05LocationPresentation.sections.map((s) => s.heading), ["Most likely area", "Reading", "Where to look", "One thing to watch", "Practical step"], "location renders area + ranked candidates + practical step (no generic extension section)");
// Reading holds the full synthesis; the extension is rendered BESIDE candidate_rank 1, not as a separate section.
assert.equal(v05LocationPresentation.sections[1].body, v05Location.synthesis, "Reading holds the complete synthesis");
assert.deepEqual(v05LocationPresentation.sections[2].items, ["the bedroom — related: A document pouch is a direct container for a passport.", "the kitchen"], "extension rendered beside candidate_rank 1; other candidates unchanged");
assert.match(serverSource, /id="v5"/u, "browser exposes the v5 toggle");
assert.match(serverSource, /\/api\/run\/free-text-v5/u, "browser routes the v5 endpoint");
console.log("internal Dice AI Lab contract passed: bootstrap, dual modes, 36 closed faces, v3 synthesis presentation, route-mismatch copy, metadata-only, provider_calls=0, v5 judgment/timing/location rendering");
