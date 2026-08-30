import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
const v05Metadata = { request_mode: "founder_free_text", language: "en", question_mode: "judgment", result_class: "completed", provider_calls: 2, latency_bucket: "lt_12s", cost_bucket: "within_cap", units_consumed: 0, persistence_writes: 0 };
const v05FreeText = { question: "Should I accept this promotion?", planet_id: "jupiter", sign_id: "sagittarius", house_id: "house_1" };
assert.equal((await executeLabFreeTextV05Request(v05FreeText, { providerEnabled: false })).status, 503, "v5 default-off returns disabled");
const v05Live = await executeLabFreeTextV05Request(v05FreeText, { providerEnabled: true, gatewayFactory: () => ({ run: async (body) => { assert.deepEqual(Object.keys(body), ["question", "planet_id", "sign_id", "house_id"]); return { kind: "completed", result: v05Judgment, question_mode: "judgment", metadata: v05Metadata }; } }) });
assert.equal(v05Live.status, 200);
assert.equal(v05Live.body.presentation.kind, "reading");
assert.equal(v05Live.body.classification.question_mode, "judgment", "v5 surfaces the selected mode");
assert.deepEqual(v05Live.body.presentation.sections.map((s) => s.heading), ["Result", "Reading", "One thing to watch", "Suggested follow-up questions"], "judgment renders Result (planet+house prose) + follow-ups, no Practical step");
assert.equal(v05Live.body.presentation.sections[0].body, "Jupiter is a major benefic at full strength here. House 1 is the most supportive setting, with the matter in your hands.", "Result body joins the two fixed sides");
// Opening identifies the dice landing ONLY (no first sentence of synthesis spliced in).
assert.equal(v05Live.body.presentation.opening, "You drew Jupiter in Sagittarius in the 1st House.", "opening is landing-only, no synthesis splice");
// The complete synthesis stays intact under Reading (not truncated by an opening splice).
assert.equal(v05Live.body.presentation.sections[1].body, v05Judgment.synthesis, "Reading holds the complete synthesis");
assert.equal(v05Live.body.presentation.sections[3].items.length, 1, "follow-up questions rendered as items");
assert.equal(v05Live.body.provider_calls, 2, "two provider calls recorded (mode + interpret)");
assert.equal(v05Live.body.metadata.units_consumed, 0, "metadata carries units_consumed 0");
const v05Review = await executeLabFreeTextV05Request(v05FreeText, { providerEnabled: true, gatewayFactory: () => ({ run: async () => ({ kind: "route_review", code: "DICE_ROUTE_REVIEW_REQUIRED", metadata: null }) }) });
assert.equal(v05Review.body.code, "DICE_ROUTE_REVIEW_REQUIRED");
assert.equal(v05Review.body.presentation.kind, "route_review");
// Test 6 (§20) — the specific bundled-question member copy is rendered for a bundled outcome.
const v05Bundled = await executeLabFreeTextV05Request(v05FreeText, { providerEnabled: true, gatewayFactory: () => ({ run: async () => ({ kind: "bundled", code: "DICE_BUNDLED_QUESTION", metadata: null }) }) });
assert.equal(v05Bundled.body.code, "DICE_BUNDLED_QUESTION", "Test 6 bundled code");
assert.equal(v05Bundled.body.presentation.message, "This contains more than one question. Each Dice throw can interpret only one clear question. Please choose one question and try again.", "Test 6 exact bundled member copy (en)");
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
