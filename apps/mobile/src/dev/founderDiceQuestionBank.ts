export const FOUNDER_QUESTION_BANK_SCHEMA = "s2_t295_founder_question_bank_v1" as const;
export const FOUNDER_QUESTION_REGISTRY_SCHEMA = "s2_t295_founder_question_registry_v1" as const;
export const FOUNDER_SELECTION_INSTRUCTION = "21 supplied; select exactly one to exclude" as const;

export type FounderDraftLanguage = "en" | "zh-Hant";

export type FounderQuestionDraft = Readonly<{
  authoring_id: string;
  language: FounderDraftLanguage;
  exact_text: string;
}>;

export const FOUNDER_ENGLISH_DRAFTS: readonly FounderQuestionDraft[] = Object.freeze([
  { authoring_id: "EN01", language: "en", exact_text: "How’s the condition in my current job like?" },
  { authoring_id: "EN02", language: "en", exact_text: "Will I be promoted in the coming review?" },
  { authoring_id: "EN03", language: "en", exact_text: "If I change my job, how soon will I be able to get a new job?" },
  { authoring_id: "EN04", language: "en", exact_text: "What should I do next weekend?" },
  { authoring_id: "EN05", language: "en", exact_text: "Shall I bring my dog to this new vet?" },
  { authoring_id: "EN06", language: "en", exact_text: "Why is the relationship between me and my girlfriend not good?" },
  { authoring_id: "EN07", language: "en", exact_text: "Does my boyfriend have an affair?" },
  { authoring_id: "EN08", language: "en", exact_text: "How can me and my girlfriend improve our relationship?" },
  { authoring_id: "EN09", language: "en", exact_text: "Will we get married? If so, when?" },
  { authoring_id: "EN10", language: "en", exact_text: "How did my interview go?" },
  { authoring_id: "EN11", language: "en", exact_text: "Where can I find my next love?" },
  { authoring_id: "EN12", language: "en", exact_text: "What should I be aware of in my next trip to Japan?" },
  { authoring_id: "EN13", language: "en", exact_text: "Why did I not get the promotion?" },
  { authoring_id: "EN14", language: "en", exact_text: "I am looking to do a side business, what should I do?" },
  { authoring_id: "EN15", language: "en", exact_text: "Where can I find my pair of glasses?" },
  { authoring_id: "EN16", language: "en", exact_text: "I am looking to start some new courses, what should I apply for?" },
  { authoring_id: "EN17", language: "en", exact_text: "When will I be pregnant?" },
  { authoring_id: "EN18", language: "en", exact_text: "Is this doctor reliable?" },
  { authoring_id: "EN19", language: "en", exact_text: "How well will the exhibition go next week?" },
  { authoring_id: "EN20", language: "en", exact_text: "What type of people is my next manager?" },
]);

export const FOUNDER_ZH_HANT_DRAFTS: readonly FounderQuestionDraft[] = Object.freeze([
  { authoring_id: "ZH01", language: "zh-Hant", exact_text: "我應唔應該去Working holiday？" },
  { authoring_id: "ZH02", language: "zh-Hant", exact_text: "Working holiday去澳洲好唔好？" },
  { authoring_id: "ZH03", language: "zh-Hant", exact_text: "Working holiday去美國好唔好？" },
  { authoring_id: "ZH04", language: "zh-Hant", exact_text: "我去到澳洲應該讀書定係做嘢？" },
  { authoring_id: "ZH05", language: "zh-Hant", exact_text: "我去到澳洲如果讀書嘅，應該讀乜嘢？" },
  { authoring_id: "ZH06", language: "zh-Hant", exact_text: "我去到澳洲做嘢嘅話，係咪應該做返我而家呢行？" },
  { authoring_id: "ZH07", language: "zh-Hant", exact_text: "我去到澳洲應該有乜嘢需要注意？" },
  { authoring_id: "ZH08", language: "zh-Hant", exact_text: "我個application 會唔會批？幾時會批？" },
  { authoring_id: "ZH09", language: "zh-Hant", exact_text: "我個application幾時會批？" },
  { authoring_id: "ZH10", language: "zh-Hant", exact_text: "我同個男朋友應唔應該繼續呢段關係？" },
  { authoring_id: "ZH11", language: "zh-Hant", exact_text: "我同我男朋友究竟而家發生咩問題？" },
  { authoring_id: "ZH12", language: "zh-Hant", exact_text: "我如果搬去佢屋企附近會唔會改善到我哋嘅關係？" },
  { authoring_id: "ZH13", language: "zh-Hant", exact_text: "我可以做乜嘢去改善我哋嘅關係？" },
  { authoring_id: "ZH14", language: "zh-Hant", exact_text: "我九月嘅運程係點？" },
  { authoring_id: "ZH15", language: "zh-Hant", exact_text: "如果我讀呢個占星course會點？" },
  { authoring_id: "ZH16", language: "zh-Hant", exact_text: "我下個星期去台灣擺展覽，個情況會係點？" },
  { authoring_id: "ZH17", language: "zh-Hant", exact_text: "我應該做乜嘢副業會賺多啲錢？" },
  { authoring_id: "ZH18", language: "zh-Hant", exact_text: "我嚟緊有個空降嘅上司，佢係一個咩人？" },
  { authoring_id: "ZH19", language: "zh-Hant", exact_text: "我今個月月會唔會到數？" },
  { authoring_id: "ZH20", language: "zh-Hant", exact_text: "我點樣先至可以到數？" },
  { authoring_id: "ZH21", language: "zh-Hant", exact_text: "我幾時先至可以搵到份新工？" },
]);

export const FOUNDER_QUESTION_DRAFTS = Object.freeze([
  ...FOUNDER_ENGLISH_DRAFTS,
  ...FOUNDER_ZH_HANT_DRAFTS,
]);

export const NON_EXCLUDABLE_ZH_AUTHORING_IDS = Object.freeze(["ZH08", "ZH09"] as const);

export type QuestionChecksum = Readonly<{
  authoring_id: string;
  sha256: string;
}>;

export function buildFounderQuestionRegistry(
  excludedZhId: string | null,
  checksums: readonly QuestionChecksum[],
) {
  if (excludedZhId === null) throw new Error("STOP_S2_T295_SELECT_EXACTLY_ONE_ZH_EXCLUSION");
  if (!FOUNDER_ZH_HANT_DRAFTS.some((draft) => draft.authoring_id === excludedZhId)) {
    throw new Error("STOP_S2_T295_UNKNOWN_ZH_EXCLUSION");
  }
  if ((NON_EXCLUDABLE_ZH_AUTHORING_IDS as readonly string[]).includes(excludedZhId)) {
    throw new Error("STOP_S2_T295_CONTROL_QUESTION_NON_EXCLUDABLE");
  }
  const checksumMap = new Map(checksums.map((item) => [item.authoring_id, item.sha256]));
  if (checksumMap.size !== 41) throw new Error("STOP_S2_T295_CHECKSUM_SET");
  const selectedZh = FOUNDER_ZH_HANT_DRAFTS.filter((draft) => draft.authoring_id !== excludedZhId);
  const selected = [...FOUNDER_ENGLISH_DRAFTS, ...selectedZh];
  const fixtures = selected.map((draft, index) => {
    const sha256 = checksumMap.get(draft.authoring_id);
    if (!sha256 || !/^[0-9a-f]{64}$/.test(sha256)) throw new Error("STOP_S2_T295_CHECKSUM_INVALID");
    const languageIndex = draft.language === "en" ? index + 1 : selectedZh.indexOf(draft) + 1;
    return Object.freeze({
      authoring_id: draft.authoring_id,
      fixture_id: `DICE-FOUNDER-${draft.language === "en" ? "EN" : "ZH"}-${String(languageIndex).padStart(2, "0")}`,
      language: draft.language,
      exact_text: draft.exact_text,
      exact_text_sha256: sha256,
      freeze_status: "locally_frozen_pending_external_review" as const,
    });
  });
  if (fixtures.length !== 40 || fixtures.filter((item) => item.language === "en").length !== 20 || fixtures.filter((item) => item.language === "zh-Hant").length !== 20) {
    throw new Error("STOP_S2_T295_NOT_20_20");
  }
  return Object.freeze({
    schema: FOUNDER_QUESTION_REGISTRY_SCHEMA,
    source_draft_schema: FOUNDER_QUESTION_BANK_SCHEMA,
    supplied_total: 41,
    excluded_authoring_id: excludedZhId,
    fixture_total: 40,
    language_totals: Object.freeze({ en: 20, "zh-Hant": 20 }),
    runtime_request_fields: Object.freeze(["fixture_id"] as const),
    runtime_status: "unavailable_pending_accepted_technical_evidence_and_founder_authorization" as const,
    fixtures: Object.freeze(fixtures),
    effects: Object.freeze({ provider_calls: 0, persistence_writes: 0, units_charged: 0 }),
  });
}
