import {
  FOUNDER_ENGLISH_DRAFTS,
  FOUNDER_QUESTION_DRAFTS,
  FOUNDER_SELECTION_INSTRUCTION,
  FOUNDER_ZH_HANT_DRAFTS,
  NON_EXCLUDABLE_ZH_AUTHORING_IDS,
  buildFounderQuestionRegistry,
} from "./founderDiceQuestionBank";

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function rejects(fn: () => unknown, code: string): void {
  try { fn(); } catch (error) {
    check(error instanceof Error && error.message === code, `expected ${code}`);
    return;
  }
  throw new Error(`expected rejection ${code}`);
}

const expectedEnglish = [
  "How’s the condition in my current job like?",
  "Will I be promoted in the coming review?",
  "If I change my job, how soon will I be able to get a new job?",
  "What should I do next weekend?",
  "Shall I bring my dog to this new vet?",
  "Why is the relationship between me and my girlfriend not good?",
  "Does my boyfriend have an affair?",
  "How can me and my girlfriend improve our relationship?",
  "Will we get married? If so, when?",
  "How did my interview go?",
  "Where can I find my next love?",
  "What should I be aware of in my next trip to Japan?",
  "Why did I not get the promotion?",
  "I am looking to do a side business, what should I do?",
  "Where can I find my pair of glasses?",
  "I am looking to start some new courses, what should I apply for?",
  "When will I be pregnant?",
  "Is this doctor reliable?",
  "How well will the exhibition go next week?",
  "What type of people is my next manager?",
] as const;

const expectedZhHant = [
  "我應唔應該去Working holiday？",
  "Working holiday去澳洲好唔好？",
  "Working holiday去美國好唔好？",
  "我去到澳洲應該讀書定係做嘢？",
  "我去到澳洲如果讀書嘅，應該讀乜嘢？",
  "我去到澳洲做嘢嘅話，係咪應該做返我而家呢行？",
  "我去到澳洲應該有乜嘢需要注意？",
  "我個application 會唔會批？幾時會批？",
  "我個application幾時會批？",
  "我同個男朋友應唔應該繼續呢段關係？",
  "我同我男朋友究竟而家發生咩問題？",
  "我如果搬去佢屋企附近會唔會改善到我哋嘅關係？",
  "我可以做乜嘢去改善我哋嘅關係？",
  "我九月嘅運程係點？",
  "如果我讀呢個占星course會點？",
  "我下個星期去台灣擺展覽，個情況會係點？",
  "我應該做乜嘢副業會賺多啲錢？",
  "我嚟緊有個空降嘅上司，佢係一個咩人？",
  "我今個月月會唔會到數？",
  "我點樣先至可以到數？",
  "我幾時先至可以搵到份新工？",
] as const;

check(FOUNDER_SELECTION_INSTRUCTION === "21 supplied; select exactly one to exclude", "instruction exact");
check(FOUNDER_QUESTION_DRAFTS.length === 41, "all 41 drafts preserved");
check(FOUNDER_ENGLISH_DRAFTS.length === 20, "20 English supplied");
check(FOUNDER_ZH_HANT_DRAFTS.length === 21, "21 zh-Hant supplied");
check(JSON.stringify(FOUNDER_ENGLISH_DRAFTS.map((item) => item.exact_text)) === JSON.stringify(expectedEnglish), "English exact bytes drifted");
check(JSON.stringify(FOUNDER_ZH_HANT_DRAFTS.map((item) => item.exact_text)) === JSON.stringify(expectedZhHant), "zh-Hant exact bytes drifted");
check(JSON.stringify(NON_EXCLUDABLE_ZH_AUTHORING_IDS) === JSON.stringify(["ZH08", "ZH09"]), "control IDs drifted");

const checksums = FOUNDER_QUESTION_DRAFTS.map((item, index) => ({ authoring_id: item.authoring_id, sha256: (index + 1).toString(16).padStart(64, "0") }));
rejects(() => buildFounderQuestionRegistry(null, checksums), "STOP_S2_T295_SELECT_EXACTLY_ONE_ZH_EXCLUSION");
rejects(() => buildFounderQuestionRegistry("ZH08", checksums), "STOP_S2_T295_CONTROL_QUESTION_NON_EXCLUDABLE");
rejects(() => buildFounderQuestionRegistry("ZH09", checksums), "STOP_S2_T295_CONTROL_QUESTION_NON_EXCLUDABLE");
const registry = buildFounderQuestionRegistry("ZH21", checksums);
check(registry.fixture_total === 40, "registry must be 40");
check(registry.language_totals.en === 20 && registry.language_totals["zh-Hant"] === 20, "registry must be 20/20");
check(registry.fixtures.filter((item) => item.language === "en").every((item, index) => item.authoring_id === `EN${String(index + 1).padStart(2, "0")}`), "English IDs drifted");
check(registry.fixtures.some((item) => item.authoring_id === "ZH08") && registry.fixtures.some((item) => item.authoring_id === "ZH09"), "controls must remain");
check(!registry.fixtures.some((item) => item.authoring_id === "ZH21"), "selected exclusion must be absent");
check(registry.runtime_request_fields.join(",") === "fixture_id", "runtime must accept fixture_id only");
check(registry.effects.provider_calls === 0 && registry.effects.persistence_writes === 0 && registry.effects.units_charged === 0, "registry must be zero effect");

console.log("S2-T295 Founder question bank exact-byte fixtures passed");
