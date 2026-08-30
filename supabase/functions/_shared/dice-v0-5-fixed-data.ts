/**
 * Dice AI Interpretation Prompt v3 — technical identity v5.
 * Controlled fixed data (self-contained; does NOT import the v3
 * `classicalAttributes.ts` / `interpretationBank.ts` — v3 stays byte-unchanged,
 * §23/§8.5 of DICE_PROMPT_V3_TECHNICAL_PROPOSAL_REV4_2_FINAL.md).
 *
 * Source of every table/bank below: the controlling proposal §6, Appendix A/B/C,
 * §6.4 Element table, §6.5 v5 combined-pace matrix (Founder Decision A:
 * slowest × fast = medium), and §10/§12.0 controlled landing label table.
 */

export const DICE_V05_PROMPT_VERSION = "lumis_dice_v0_3_prompt_v5" as const;
export const DICE_V05_RESULT_SCHEMA = "lumis_dice_interpretation_v5" as const;
export const DICE_V05_MODE_SELECTION_SCHEMA = "lumis_dice_mode_selection_v5" as const;

export type DiceV05Language = "en" | "zh-Hant";

export const DICE_V05_PLANET_IDS = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
  "uranus", "neptune", "pluto", "north_node", "south_node",
] as const;
export type DiceV05PlanetId = (typeof DICE_V05_PLANET_IDS)[number];

export const DICE_V05_SIGN_IDS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
] as const;
export type DiceV05SignId = (typeof DICE_V05_SIGN_IDS)[number];

export type DiceV05Element = "Fire" | "Earth" | "Water" | "Air";
export type DiceV05Speed = "fastest" | "fast" | "medium" | "slow" | "slowest";
export type DiceV05HouseSpeed = "fast" | "medium" | "slow";
export type DiceV05Distance = "near" | "middle" | "far";
export type DiceV05Dignity = "ruler" | "exaltation" | "peregrine" | "fall" | "detriment";
export type DiceV05Strength = "strong" | "neutral" | "weak";
export type DiceV05Fortune =
  | "major_benefic" | "minor_benefic" | "major_malefic" | "minor_malefic"
  | "neutral" | "outer" | "benefic_node" | "malefic_node";
export type DiceV05HouseFortune = "great_fortune" | "fortune" | "misfortune" | "great_misfortune";

/* ---------------- Controlled landing label table (§10 / §12.0) ---------------- */
export type DiceV05Label = Readonly<{ en: string; zh: string }>;

export const PLANET_LABELS: Readonly<Record<DiceV05PlanetId, DiceV05Label>> = Object.freeze({
  sun: { en: "Sun", zh: "太陽" }, moon: { en: "Moon", zh: "月亮" }, mercury: { en: "Mercury", zh: "水星" },
  venus: { en: "Venus", zh: "金星" }, mars: { en: "Mars", zh: "火星" }, jupiter: { en: "Jupiter", zh: "木星" },
  saturn: { en: "Saturn", zh: "土星" }, uranus: { en: "Uranus", zh: "天王星" }, neptune: { en: "Neptune", zh: "海王星" },
  pluto: { en: "Pluto", zh: "冥王星" }, north_node: { en: "North Node", zh: "龍頭" }, south_node: { en: "South Node", zh: "龍尾" },
});

export const SIGN_LABELS: Readonly<Record<DiceV05SignId, DiceV05Label>> = Object.freeze({
  aries: { en: "Aries", zh: "白羊座" }, taurus: { en: "Taurus", zh: "金牛座" }, gemini: { en: "Gemini", zh: "雙子座" },
  cancer: { en: "Cancer", zh: "巨蟹座" }, leo: { en: "Leo", zh: "獅子座" }, virgo: { en: "Virgo", zh: "處女座" },
  libra: { en: "Libra", zh: "天秤座" }, scorpio: { en: "Scorpio", zh: "天蠍座" }, sagittarius: { en: "Sagittarius", zh: "射手座" },
  capricorn: { en: "Capricorn", zh: "摩羯座" }, aquarius: { en: "Aquarius", zh: "水瓶座" }, pisces: { en: "Pisces", zh: "雙魚座" },
});

const HOUSE_ZH_NUMERAL = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
export function houseLabel(houseNumber: number): DiceV05Label {
  if (!Number.isInteger(houseNumber) || houseNumber < 1 || houseNumber > 12) throw new Error("DICE_V05_HOUSE_NUMBER_INVALID");
  return Object.freeze({ en: `House ${houseNumber}`, zh: `第${HOUSE_ZH_NUMERAL[houseNumber - 1]}宮` });
}

/* ---------------- Sign → Element (§6.4) ---------------- */
export const SIGN_ELEMENT: Readonly<Record<DiceV05SignId, DiceV05Element>> = Object.freeze({
  aries: "Fire", leo: "Fire", sagittarius: "Fire",
  taurus: "Earth", virgo: "Earth", capricorn: "Earth",
  gemini: "Air", libra: "Air", aquarius: "Air",
  cancer: "Water", scorpio: "Water", pisces: "Water",
});

/* ---------------- Sign essence / detail (Level-1 injected values, §10) ----------------
 * COPIED VERBATIM from the approved product source `SIGN_BANK`
 * (apps/mobile/src/features/dice/interpretationBank.ts): essence_en = SIGN_BANK.essence,
 * detail_en = SIGN_BANK.detail; essence_zh / detail_zh = the first two ／-separated parts of
 * SIGN_BANK.zhRef. No new controlled astrology is authored here. A build-time source check
 * (dice-v0-5-level1.fixtures) asserts these equal SIGN_BANK. Used ONLY for the Level-1 envelope. */
export type SignEssenceRow = Readonly<{ essence_en: string; detail_en: string; essence_zh: string; detail_zh: string }>;
export const SIGN_ESSENCE: Readonly<Record<DiceV05SignId, SignEssenceRow>> = Object.freeze({
  aries: { essence_en: "Direct — action first", detail_en: "Initiating, fast, competitive", essence_zh: "直接、行動先行", detail_zh: "開創、快速、有競爭心" },
  taurus: { essence_en: "Steady — one step at a time", detail_en: "Practical, savoring, slow and thorough", essence_zh: "穩健、循序漸進", detail_zh: "重實際、重享受、慢工出細活" },
  gemini: { essence_en: "Conversation, information, and flexibility", detail_en: "Curious, adaptable, many channels of communication", essence_zh: "交流、資訊與彈性", detail_zh: "好奇、靈活、多渠道溝通" },
  cancer: { essence_en: "Care and emotional connection", detail_en: "Safety, home, nostalgia", essence_zh: "照顧、情感連結", detail_zh: "安全感、家、念舊" },
  leo: { essence_en: "Confidence — showing up generously", detail_en: "Stage presence, creativity, warmth", essence_zh: "自信、大方展現", detail_zh: "舞台感、創造力、慷慨" },
  virgo: { essence_en: "Care with detail — practical analysis", detail_en: "Planning, refinement, attention to detail", essence_zh: "細心、實際分析", detail_zh: "規劃、改善、注重細節" },
  libra: { essence_en: "Balance and coordinating relationships", detail_en: "Cooperation, negotiation, aesthetics", essence_zh: "平衡、協調關係", detail_zh: "合作、談判、美感" },
  scorpio: { essence_en: "Depth — facing things completely", detail_en: "Focus, insight, unafraid of the shadow", essence_zh: "深入、徹底面對", detail_zh: "專注、洞察、不怕黑暗面" },
  sagittarius: { essence_en: "Looking further — exploring meaning", detail_en: "Optimism, learning, distant horizons", essence_zh: "放遠目光、探索意義", detail_zh: "樂觀、學習、遠方" },
  capricorn: { essence_en: "Planning — building for the long term", detail_en: "Diligence, discipline, a clear goal", essence_zh: "有計劃、長線經營", detail_zh: "實幹、紀律、目標感" },
  aquarius: { essence_en: "Thinking outside the frame", detail_en: "Innovation, group vision, independence", essence_zh: "跳出框架思考", detail_zh: "創新、群體視野、獨立" },
  pisces: { essence_en: "Intuition and empathy", detail_en: "Imagination, acceptance, artistic feeling", essence_zh: "直覺與同理心", detail_zh: "想像力、包容、藝術感" },
});

/* A controlled place: a stable semantic `slug` (the evidence id leaf, unaffected by
 * list order) plus its bilingual text. Wire key + gid derive from `slug` (§16). */
export type LocPlace = Readonly<{ slug: string; en: string; zh: string }>;

// Element direction/place — the ONLY Sign-derived location clue (manual §5 / §6.4, EXACT).
export const ELEMENT_TABLE: Readonly<Record<DiceV05Element, Readonly<{ direction: string; places: readonly LocPlace[] }>>> = Object.freeze({
  Fire: { direction: "East", places: [
    { slug: "heat_or_fire", en: "near heat or fire", zh: "靠近熱源或火" },
    { slug: "chimney", en: "chimney", zh: "煙囪" },
    { slug: "exterior_wall", en: "near an exterior wall", zh: "鄰近房屋圍牆" },
  ] },
  Earth: { direction: "South", places: [
    { slug: "road_or_ground", en: "road or ground", zh: "路面或地面" },
    { slug: "earth_mud_clay", en: "near earth, mud or clay", zh: "接近泥或黏土" },
    { slug: "basement", en: "basement", zh: "地下室" },
  ] },
  Air: { direction: "West", places: [
    { slug: "high_open_place", en: "a high or open place", zh: "高或視野廣闊的地方" },
    { slug: "upper_room_floor", en: "an upper room or floor", zh: "房屋中上層" },
    { slug: "roof_or_window", en: "near a roof or window", zh: "接近屋頂或窗戶" },
    { slug: "mountain_high_ground", en: "a mountain or high ground", zh: "高山或高地" },
    { slug: "off_the_floor", en: "off the floor", zh: "離開地面" },
  ] },
  Water: { direction: "North", places: [
    { slug: "near_water", en: "near water", zh: "靠近水" },
    { slug: "bathroom", en: "bathroom", zh: "浴室" },
    { slug: "kitchen", en: "kitchen", zh: "廚房" },
    { slug: "damp_place", en: "a damp place", zh: "潮濕地方" },
    { slug: "pool_pond_river", en: "a pool, pond or river", zh: "水池、池塘或河流" },
  ] },
});

/* ---------------- Planet fixed nature + speed + traits + essence (§6.1 / App B / §6.6) ---------------- */
export type PlanetRow = Readonly<{
  fortune: DiceV05Fortune; fortune_zh: string; speed: DiceV05Speed;
  constructive_en: string; difficult_en: string; constructive_zh: string; difficult_zh: string;
  essence_en: string; detail_en: string; essence_zh: string; detail_zh: string;
}>;

export const PLANET_TABLE: Readonly<Record<DiceV05PlanetId, PlanetRow>> = Object.freeze({
  sun: { fortune: "neutral", fortune_zh: "中性（無固定吉凶）", speed: "medium",
    constructive_en: "Candid, loyal, confident, generous, sincere; a respected leader with self-command", difficult_en: "Arrogant, conceited, dismissive, wasteful, all show, selfish, attention-seeking",
    constructive_zh: "坦白、忠誠、自信、慷慨、真誠、有自制力的領袖、受尊重", difficult_zh: "傲慢、自負、目中無人、浪費、虛有其表、自私、需要別人注意",
    essence_en: "prominence, leadership, authority, vitality, self-expression", detail_en: "recognition, creation, being seen, central role",
    essence_zh: "顯赫、領導、權威、生命力、自我表達", detail_zh: "認可、創造、被看見、核心角色" },
  moon: { fortune: "neutral", fortune_zh: "中性（無固定吉凶）", speed: "fastest",
    constructive_en: "Peace-loving, gentle, fluid, sensitive to people and surroundings; a good messenger", difficult_en: "Moody, passive, easily swayed, drifting with the current",
    constructive_zh: "愛和平、溫柔、具流動性、對人和環境敏感、良好的傳訊者", difficult_zh: "情緒化、有惰性、柔弱、隨波逐流、容易被影響",
    essence_en: "home, family, care, nourishment, daily rhythm", detail_en: "comfort, receptivity, memory, everyday needs",
    essence_zh: "家庭、照顧、滋養、日常節奏", detail_zh: "安穩、接受、記憶、日常需要" },
  mercury: { fortune: "neutral", fortune_zh: "中性（無固定吉凶）", speed: "fast",
    constructive_en: "Clever, curious, creative, logical, articulate, light and quick", difficult_en: "Gossipy, spreads misinformation, erratic, two-faced, unstable, restless",
    constructive_zh: "聰明、好奇心強、富創意、邏輯強、善於溝通、輕巧快速", difficult_zh: "愛說是非、散播假消息、失控、雙面、不穩定、不安",
    essence_en: "information, communication, learning, movement, exchange", detail_en: "documents, thinking, short travel, transactions",
    essence_zh: "資訊、溝通、學習、流動、交換", detail_zh: "文件、思考、短途、交易" },
  venus: { fortune: "minor_benefic", fortune_zh: "小吉星", speed: "fast",
    constructive_en: "Charming, at ease, sociable, giving, attractive, joyful", difficult_en: "Indulgent at the cost of duty, lazy, prone to bad habits, jealous",
    constructive_zh: "有魅力、寫意、社交能力強、樂於付出、有吸引力、開朗歡樂", difficult_zh: "沉溺享樂而忽略責任、懶惰、不良嗜好、嫉妒",
    essence_en: "value, relationship, harmony, pleasure, beauty", detail_en: "connection, worth, comfort, attraction",
    essence_zh: "價值、關係、和諧、愉悅、美感", detail_zh: "連結、價值、舒適、吸引" },
  mars: { fortune: "minor_malefic", fortune_zh: "小凶星", speed: "medium",
    constructive_en: "Brave, driven, enterprising, direct, proactive, action-oriented", difficult_en: "Violent, impulsive, troublesome, treacherous; accidents, injuries, conflict",
    constructive_zh: "勇敢、有衝勁、進取、直接、主動、有行動力", difficult_zh: "暴力、衝動、麻煩、背信棄義、意外、受傷、爭執",
    essence_en: "action, drive, assertion, effort, competition", detail_en: "initiative, force, courage, doing",
    essence_zh: "行動、動力、主張、努力、競爭", detail_zh: "主動、力量、勇氣、實行" },
  jupiter: { fortune: "major_benefic", fortune_zh: "大吉星", speed: "slow",
    constructive_en: "Generous, trustworthy, honest, principled, wise, capable and resourceful", difficult_en: "Wasteful, reckless, indulgent, exaggerating, greedy and careless",
    constructive_zh: "大方、守信、慷慨、誠實、自由、品德高尚、有智慧、有能力、有資源", difficult_zh: "浪費、魯莽、放縱、誇張、貪婪、粗心大意",
    essence_en: "growth, meaning, opportunity, expansion, wisdom", detail_en: "breadth, faith, higher learning, resources",
    essence_zh: "成長、意義、機會、擴展、智慧", detail_zh: "廣度、信念、高等學習、資源" },
  saturn: { fortune: "major_malefic", fortune_zh: "大凶星", speed: "slow",
    constructive_en: "Patient, persistent, serious, committed, diligent, mature, responsible, authoritative", difficult_en: "Fearful, hostile, insincere, miserly, critical, aloof, harsh, pressured, gloomy",
    constructive_zh: "有耐性、持續、認真、承諾、勤奮、成熟、有責任感、權威", difficult_zh: "恐懼、敵意、不真誠、吝嗇、批評他人、疏離、嚴厲、壓力大、憂鬱",
    essence_en: "Responsibility, structure and patience", detail_en: "Time, discipline, maturity and career foundations",
    essence_zh: "責任、結構與耐性", detail_zh: "時間、紀律、成熟、事業根基" },
  uranus: { fortune: "outer", fortune_zh: "三王星（無古典吉凶，鎮守而已）", speed: "slowest",
    constructive_en: "Stimulation, breakthrough; outside the mainstream", difficult_en: "Stimulation, separation; outside the mainstream",
    constructive_zh: "刺激、突破、非主流、非常態", difficult_zh: "刺激、分離、非主流、非常態",
    essence_en: "change, independence, the unconventional", detail_en: "sudden shifts, technology, the new",
    essence_zh: "改變、獨立、非常規", detail_zh: "突變、科技、新事物" },
  neptune: { fortune: "outer", fortune_zh: "三王星（無古典吉凶）", speed: "slowest",
    constructive_en: "Dreams, spirituality; outside the mainstream", difficult_en: "Deception, confusion; outside the mainstream",
    constructive_zh: "夢想、靈性、非主流、非常態", difficult_zh: "欺騙、迷惘、非主流、非常態",
    essence_en: "imagination, dissolution, the subtle", detail_en: "ideals, blur, the unseen",
    essence_zh: "想像、消融、細微", detail_zh: "理想、模糊、看不見的" },
  pluto: { fortune: "outer", fortune_zh: "三王星（無古典吉凶）", speed: "slowest",
    constructive_en: "Deep transformation, rebirth; outside the mainstream", difficult_en: "Obsession, control; outside the mainstream",
    constructive_zh: "深層轉化、重生、非主流、非常態", difficult_zh: "沉溺、控制、非主流、非常態",
    essence_en: "depth, power, renewal", detail_en: "the hidden, intensity, deep change",
    essence_zh: "深度、力量、更新", detail_zh: "隱藏、強烈、深層改變" },
  north_node: { fortune: "benefic_node", fortune_zh: "吉", speed: "slow",
    constructive_en: "Opportunity, growth, the direction ahead — room to advance", difficult_en: "The unease that comes with a new direction",
    constructive_zh: "機會、成長、未來方向、有進步空間", difficult_zh: "新方向帶來的不安",
    essence_en: "growth, the way forward, new development", detail_en: "learning, progress, the unfamiliar next step",
    essence_zh: "成長、前路、新發展", detail_zh: "學習、進步、陌生的下一步" },
  south_node: { fortune: "malefic_node", fortune_zh: "凶", speed: "slow",
    constructive_en: "Accumulated gifts and experience", difficult_en: "Old habits, attachment, stagnation — something to let go",
    constructive_zh: "累積的天賦與經驗", difficult_zh: "過去的慣性、執著、停滯不前、需要放手",
    essence_en: "the past, what is carried, release", detail_en: "old patterns, the familiar, letting go",
    essence_zh: "過去、承載之物、放下", detail_zh: "舊模式、熟悉的、放手" },
});

export const NODE_IDS: ReadonlySet<DiceV05PlanetId> = new Set(["north_node", "south_node"]);

/* ---------------- Essential dignity (Appendix A) ---------------- */
type DignityRow = Readonly<{ ruler: readonly DiceV05SignId[]; exaltation: readonly DiceV05SignId[]; fall: readonly DiceV05SignId[]; detriment: readonly DiceV05SignId[] }>;
export const DIGNITY_TABLE: Readonly<Record<DiceV05PlanetId, DignityRow>> = Object.freeze({
  sun: { ruler: ["leo"], exaltation: ["aries"], fall: ["libra"], detriment: ["aquarius"] },
  moon: { ruler: ["cancer"], exaltation: ["taurus"], fall: ["scorpio"], detriment: ["capricorn"] },
  mercury: { ruler: ["gemini", "virgo"], exaltation: ["virgo"], fall: ["pisces"], detriment: ["sagittarius", "pisces"] },
  venus: { ruler: ["taurus", "libra"], exaltation: ["pisces"], fall: ["virgo"], detriment: ["aries", "scorpio"] },
  mars: { ruler: ["aries", "scorpio"], exaltation: ["capricorn"], fall: ["cancer"], detriment: ["taurus", "libra"] },
  jupiter: { ruler: ["sagittarius", "pisces"], exaltation: ["cancer"], fall: ["capricorn"], detriment: ["gemini", "virgo"] },
  saturn: { ruler: ["capricorn", "aquarius"], exaltation: ["libra"], fall: ["aries"], detriment: ["cancer", "leo"] },
  uranus: { ruler: ["aquarius"], exaltation: [], fall: [], detriment: [] },
  neptune: { ruler: ["pisces"], exaltation: [], fall: [], detriment: [] },
  pluto: { ruler: ["scorpio"], exaltation: [], fall: [], detriment: [] },
  north_node: { ruler: [], exaltation: [], fall: [], detriment: [] },
  south_node: { ruler: [], exaltation: [], fall: [], detriment: [] },
});

const DIGNITY_ZH: Readonly<Record<DiceV05Dignity, string>> = Object.freeze({
  ruler: "守護（最強）", exaltation: "旺（強）", peregrine: "一般／無特殊尊貴", fall: "落陷（弱）", detriment: "落陷（最弱）",
});

export type DignityResolution = Readonly<{ dignity: DiceV05Dignity | null; dignity_zh: string | null; strength: DiceV05Strength }>;

/**
 * Deterministic precedence (Appendix A / §6.2): ruler∨exaltation ⇒ strong (ruler
 * label wins); fall∨detriment ⇒ weak (detriment label wins — strongest-applicable
 * weakness, so Mercury-in-Pisces ⇒ detriment, C2); else peregrine/neutral.
 * Nodes have no dignity ⇒ null/null/neutral (C1/C5).
 */
export function dignityOf(planet: DiceV05PlanetId, sign: DiceV05SignId): DignityResolution {
  if (NODE_IDS.has(planet)) return Object.freeze({ dignity: null, dignity_zh: null, strength: "neutral" });
  const row = DIGNITY_TABLE[planet];
  if (row.ruler.includes(sign)) return dr("ruler", "strong");
  if (row.exaltation.includes(sign)) return dr("exaltation", "strong");
  if (row.detriment.includes(sign)) return dr("detriment", "weak");
  if (row.fall.includes(sign)) return dr("fall", "weak");
  return dr("peregrine", "neutral");
}
function dr(dignity: DiceV05Dignity, strength: DiceV05Strength): DignityResolution {
  return Object.freeze({ dignity, dignity_zh: DIGNITY_ZH[dignity], strength });
}

/* ---------------- House fortune / rank / speed / distance (§6.3) ---------------- */
export type HouseRow = Readonly<{
  fortune: DiceV05HouseFortune; fortune_zh: string; rank: number; speed: DiceV05HouseSpeed; distance: DiceV05Distance;
  essence_en: string; detail_en: string; essence_zh: string; detail_zh: string;
}>;
export const HOUSE_TABLE: Readonly<Record<number, HouseRow>> = Object.freeze({
  1: { fortune: "great_fortune", fortune_zh: "大吉", rank: 1, speed: "fast", distance: "near", essence_en: "the self and immediate person", detail_en: "own body, own space, own agency", essence_zh: "自身與眼前的人", detail_zh: "自身、自己的空間、自主" },
  2: { fortune: "misfortune", fortune_zh: "凶", rank: 9, speed: "medium", distance: "middle", essence_en: "money, possessions, values", detail_en: "resources, income, what is owned", essence_zh: "金錢、財物、價值", detail_zh: "資源、收入、擁有物" },
  3: { fortune: "fortune", fortune_zh: "吉", rank: 8, speed: "slow", distance: "far", essence_en: "communication and short travel", detail_en: "documents, siblings, neighbours, local movement", essence_zh: "溝通與短途", detail_zh: "文件、兄弟姊妹、鄰居、就近走動" },
  4: { fortune: "great_fortune", fortune_zh: "大吉", rank: 4, speed: "fast", distance: "near", essence_en: "home, family, foundations", detail_en: "parents, property, private/hidden household space", essence_zh: "家、家人、根基", detail_zh: "父母、物業、私密或隱蔽的家居空間" },
  5: { fortune: "fortune", fortune_zh: "吉", rank: 6, speed: "medium", distance: "middle", essence_en: "creativity, pleasure, children", detail_en: "recreation, romance, self-expression", essence_zh: "創造、娛樂、子女", detail_zh: "消遣、戀愛、自我表達" },
  6: { fortune: "great_misfortune", fortune_zh: "大凶", rank: 11, speed: "slow", distance: "far", essence_en: "Daily work and service", detail_en: "Duties, routines, colleagues and execution", essence_zh: "日常工作與服務", detail_zh: "職責、流程、同事與日常執行" },
  7: { fortune: "great_fortune", fortune_zh: "大吉", rank: 3, speed: "fast", distance: "near", essence_en: "the other person, partner, destination", detail_en: "counterpart, adviser, agreed meeting point", essence_zh: "對方、伴侶、目的地", detail_zh: "對象、顧問、約定的地點" },
  8: { fortune: "misfortune", fortune_zh: "凶", rank: 10, speed: "medium", distance: "middle", essence_en: "shared resources, risk, the confidential", detail_en: "others' money, debt, loss, the hidden", essence_zh: "共享資源、風險、機密", detail_zh: "別人的金錢、債務、損失、隱藏" },
  9: { fortune: "fortune", fortune_zh: "吉", rank: 7, speed: "slow", distance: "far", essence_en: "long travel, higher learning, law", detail_en: "foreign places, publishing, guidance", essence_zh: "遠行、高等學習、法律", detail_zh: "外地、出版、指導" },
  10: { fortune: "great_fortune", fortune_zh: "大吉", rank: 2, speed: "fast", distance: "near", essence_en: "Career and reputation", detail_en: "Status, achievement, managers and public image", essence_zh: "事業與名聲", detail_zh: "地位、成就、上司、公眾形象" },
  11: { fortune: "fortune", fortune_zh: "吉", rank: 5, speed: "medium", distance: "middle", essence_en: "friends, groups, hopes", detail_en: "allies, community, plans", essence_zh: "朋友、群體、願望", detail_zh: "盟友、社群、計劃" },
  12: { fortune: "great_misfortune", fortune_zh: "大凶", rank: 12, speed: "slow", distance: "far", essence_en: "The hidden, private and closure", detail_en: "Behind-the-scenes work, retreat, research and solitude", essence_zh: "隱蔽、私人與結束", detail_zh: "幕後工作、退隱、研究與獨處" },
});

/* ---------------- v5 combined-pace matrix (§6.5; Founder Decision A) ---------------- */
// slowest × fast = medium (differs from the v3 helper ONLY at this cell).
const PACE_MATRIX: Readonly<Record<DiceV05Speed, Readonly<Record<DiceV05HouseSpeed, DiceV05Speed>>>> = Object.freeze({
  fastest: { fast: "fast", medium: "fast", slow: "medium" },
  fast: { fast: "fast", medium: "medium", slow: "medium" },
  medium: { fast: "medium", medium: "medium", slow: "slow" },
  slow: { fast: "medium", medium: "slow", slow: "slow" },
  slowest: { fast: "medium", medium: "slow", slow: "slow" },
});
export function combinedPaceV05(planetSpeed: DiceV05Speed, houseSpeed: DiceV05HouseSpeed): DiceV05Speed {
  return PACE_MATRIX[planetSpeed][houseSpeed];
}

/* ---------------- Location bank (Appendix C; COMPLETE normalized transcription) ----------------
 * Every controlled related place from proposal Appendix C is present; nothing is
 * summarised or omitted. Each place carries a stable semantic `slug` (LocPlace);
 * the wire key is `p.related.<slug>` / `h.related.<slug>` / `e.<slug>` (plus the
 * fixed `p.theme`,`p.context`,`h.setting`,`h.context`), and the gid is
 * planet.<id>.(theme|context|related.<slug>), house.<n>.(setting|context|related.<slug>),
 * element.<element>.<slug> (§16). Semantic ids are stable under list reordering.
 * (Related-place expansions are Founder-directed reviewing-AI content per Appendix C.) */
export type LocationPlanetBank = Readonly<{ theme_en: string; theme_zh: string; context_en: string; context_zh: string; related: readonly LocPlace[] }>;
export type LocationHouseBank = Readonly<{ setting_en: string; setting_zh: string; context_en: string; context_zh: string; related: readonly LocPlace[] }>;

export const LOCATION_PLANET_BANK: Readonly<Record<DiceV05PlanetId, LocationPlanetBank>> = Object.freeze({
  sun: { theme_en: "prominence, leadership, authority, visibility, centrality, performance, creation, recognition", theme_zh: "顯赫、領導、權威、可見、核心、表演、創造、認可",
    context_en: "work → management, office, public-facing, presentation or leadership; lost item → a central, visible, important, displayed or official-work area before obscure storage; do not convert Sun into a Fire direction unless the Sign is Fire", context_zh: "工作→管理、辦公室、對外、簡報或領導；遺失物→先看核心、顯眼、重要、展示或正式工作的地方，其次才是隱蔽收納；除非星座屬火，否則不要把太陽當成火方位",
    related: [
      { slug: "leader_office", en: "a leader's, manager's, owner's or senior office", zh: "領導、經理、負責人或高層的辦公室" },
      { slug: "executive_area", en: "an executive, administration, command or leadership area", zh: "行政、管理、指揮或領導區" },
      { slug: "stage", en: "a stage, theatre, performance, studio, rehearsal or presentation space", zh: "舞台、劇院、表演、工作室、排練或簡報空間" },
      { slug: "prominent_place", en: "a public-facing, prominent, formal, prestigious or highly visible place", zh: "對外、顯眼、正式、有名望或高度可見的地方" },
      { slug: "central_focus", en: "the central or focal part of a room, workplace, building or event venue", zh: "房間、工作場所、建築或活動場地的中心或焦點位置" },
      { slug: "reception_award", en: "a reception, ceremonial, awards, recognition or display area", zh: "接待、典禮、頒獎、表彰或陳列區" },
      { slug: "self_expression", en: "a place of self-expression, creation, publicity or being seen", zh: "自我表達、創作、宣傳或被看見的地方" },
      { slug: "home_display", en: "in a home: the main living area, home office, display shelf, trophy area or place where important items are deliberately presented", zh: "在家中：主要起居區、家居辦公室、陳列架、獎座區或刻意展示重要物品的地方" },
    ] },
  moon: { theme_en: "home, family, domestic life, care, food, nourishment, water, night, everyday household security", theme_zh: "家庭、家人、居家、照顧、食物、滋養、水、夜間、日常家居保障",
    context_en: "if last handled at home → bedroom, living, dining, kitchen or a family member's room; food/drink/caregiving/family/sleep/daily-use → those functional areas; no emotional or personality commentary", context_zh: "若最後在家中處理→睡房、客廳、飯廳、廚房或家人的房間；食物、飲料、照顧、家人、睡眠、日常使用→相應功能區；不作情緒或性格評論",
    related: [
      { slug: "family_home", en: "the questioner's or family home, or a family member's place", zh: "問卜者或家人的家，或家庭成員的地方" },
      { slug: "bedroom_private", en: "bedroom, living room, family room, nursery, child's room or private domestic area", zh: "睡房、客廳、家庭房、育嬰室、兒童房或私人居家空間" },
      { slug: "kitchen_food", en: "kitchen, dining, pantry, food cupboard, refrigerator area, restaurant, café, canteen or food-service", zh: "廚房、飯廳、儲物間、食物櫃、雪櫃區、餐廳、咖啡店、飯堂或供餐處" },
      { slug: "rest_care_place", en: "a place to rest, sleep, eat, cook, receive care or look after family", zh: "休息、睡覺、進食、煮食、受照顧或照顧家人的地方" },
      { slug: "near_water_domestic", en: "near water, drinks, cups, sinks, washing, the sea, boats or waterfront when supported", zh: "在有支持時：近水、飲料、杯、洗手盆、洗滌、海、船或水岸" },
      { slug: "caregiving_service", en: "caregiving, childcare, maternity, nursing, hospitality or domestic-service", zh: "照顧、托兒、產科、護理、款待或家務服務" },
      { slug: "household_storage", en: "familiar household storage chosen for safekeeping", zh: "為安全收藏而選的熟悉家居收納" },
      { slug: "night_routine_place", en: "a place used more at night or in a domestic routine", zh: "較常在夜間或日常家居流程使用的地方" },
    ] },
  mercury: { theme_en: "information, documents, writing, learning, communication, movement, short travel, transactions, devices", theme_zh: "資訊、文件、書寫、學習、溝通、走動、短途、交易、裝置",
    context_en: "documents or travel papers → document storage, a work-study desk, a bag, a vehicle or transit; not 'a communicative person'", context_zh: "文件或旅行證件→文件收納、工作或讀書的書桌、袋、車輛或交通位置；不是「一個健談的人」",
    related: [
      { slug: "school", en: "school, classroom, tutorial room, library, bookstore, study room, training room or examination area", zh: "學校、課室、補習室、圖書館、書店、自修室、訓練室或試場" },
      { slug: "desk_office", en: "desk, writing table, stationery, document cabinet, filing area, mailroom, printer-copier or office communications", zh: "書桌、寫字檯、文具、文件櫃、存檔區、收發室、影印機或辦公室通訊" },
      { slug: "documents", en: "near books, notebooks, letters, forms, receipts, tickets, passports, identification or packaging labels", zh: "近書本、筆記、信件、表格、收據、車票、護照、證件或包裝標籤" },
      { slug: "devices", en: "near a phone, computer, tablet, router, charger, keyboard or comms device", zh: "近電話、電腦、平板、路由器、充電器、鍵盤或通訊裝置" },
      { slug: "transport", en: "bus stop, railway station, airport transit, taxi, vehicle, bicycle area, ticket counter or short-trip bag", zh: "巴士站、火車站、機場轉機、的士、車輛、單車區、售票櫃檯或短途袋" },
      { slug: "courier_reception", en: "courier, post office, delivery, reception counter, information desk or customer-service counter", zh: "速遞、郵局、派送、接待櫃檯、詢問處或客戶服務櫃檯" },
      { slug: "workspace_people", en: "a sibling's, neighbour's, student's, writer's, salesperson's or messenger's workspace", zh: "兄弟姊妹、鄰居、學生、作者、銷售員或信差的工作空間" },
      { slug: "small_container", en: "a small container for papers or travel items (document pouch, briefcase, laptop bag, handbag compartment or desk drawer)", zh: "存放文件或旅行物品的小容器（文件袋、公事包、手提電腦袋、手袋間格或書桌抽屜）" },
    ] },
  venus: { theme_en: "beauty, art, pleasure, harmony, shopping, adornment, relationships, music, celebration", theme_zh: "美、藝術、愉悅、和諧、購物、裝飾、關係、音樂、慶祝",
    context_en: "jewellery, cosmetics, clothes, gifts or art → their relevant storage or display; don't infer 'luxury' without support", context_zh: "首飾、化妝品、衣物、禮物或藝術品→相關收納或展示處；沒有支持不要推斷「奢華」",
    related: [
      { slug: "gallery", en: "gallery, museum, art studio, craft room, design studio, music room or concert venue", zh: "畫廊、博物館、美術工作室、手作室、設計工作室、音樂室或音樂會場地" },
      { slug: "garden", en: "garden, flower shop, florist, landscaped area, park or decorative outdoor area", zh: "花園、花店、花藝、園景區、公園或裝飾性戶外區" },
      { slug: "shop", en: "shop, boutique, department store, shopping centre, gift shop, jewellery store or luxury retail", zh: "商店、精品店、百貨公司、購物中心、禮品店、珠寶店或奢侈品零售" },
      { slug: "salon_wardrobe", en: "beauty salon, spa, cosmetics area, dressing room, wardrobe, vanity table, jewellery box, accessory drawer or clothing storage", zh: "美容院、水療、化妝品區、更衣室、衣櫃、梳妝台、首飾盒、飾物抽屜或衣物收納" },
      { slug: "celebration_venue", en: "restaurant, wedding venue, celebration, date venue, lounge or pleasant social setting", zh: "餐廳、婚禮場地、慶祝、約會地點、休息廳或宜人的社交場合" },
      { slug: "near_beautiful_items", en: "near artwork, decoration, flowers, perfume, cosmetics, jewellery, clothing, gifts, music equipment or items chosen for beauty", zh: "近藝術品、裝飾、花、香水、化妝品、首飾、衣物、禮物、音樂器材或為美感而選的物品" },
      { slug: "relationship_space", en: "a partner's personal area or a shared relationship or celebration space", zh: "伴侶的私人區域，或共享的關係或慶祝空間" },
    ] },
  mars: { theme_en: "action, heat, force, competition, sport, tools, cutting, conflict, machinery, surgery", theme_zh: "行動、熱、力量、競爭、運動、工具、切割、衝突、機械、手術",
    context_en: "phrase any danger cautiously; no emergency claim from Mars alone; a fire or heat direction needs a Fire Sign", context_zh: "任何危險都要謹慎表述；單憑火星不作緊急聲稱；火或熱的方位需配火象星座",
    related: [
      { slug: "gym", en: "gym, sports field, stadium, training area, martial-arts school, competition venue or exercise space", zh: "健身室、運動場、體育館、訓練區、武術學校、比賽場地或運動空間" },
      { slug: "workshop", en: "workshop, garage, repair area, mechanical room, tool room, hardware, construction or machinery area", zh: "工作坊、車房、維修區、機械房、工具房、五金、建造或機械區" },
      { slug: "kitchen_work", en: "a kitchen work area when knives, cutting, heat or active preparation is relevant", zh: "涉及刀具、切割、熱力或動手準備時的廚房工作區" },
      { slug: "surgical", en: "operating theatre, surgical, emergency or first-aid area when supported", zh: "在有支持時：手術室、外科、急症或急救區" },
      { slug: "near_sharp_hot", en: "near sharp tools, blades, sports equipment, engines, heating equipment or active machinery", zh: "近利器、刀刃、運動器材、引擎、加熱設備或運作中的機械" },
      { slug: "conflict_place", en: "a place of argument, confrontation, accident, urgent action or physical competition", zh: "爭執、對抗、意外、緊急行動或體能競賽的地方" },
      { slug: "security_service", en: "security, military, police, firefighting or emergency-response when supported", zh: "在有支持時：保安、軍事、警察、消防或緊急應變" },
    ] },
  jupiter: { theme_en: "higher learning, religion, law, publishing, expansion, wealth, large institutions, overseas affairs", theme_zh: "高等學習、宗教、法律、出版、擴展、財富、大型機構、海外事務",
    context_en: "choose among education, law, religion, publishing, finance, corporate or overseas by the question; distance comes from the House", context_zh: "按問題在教育、法律、宗教、出版、財務、企業或海外之間選擇；距離由宮位決定",
    related: [
      { slug: "temple", en: "temple, church, religious institution, spiritual teaching centre or ceremonial religious place", zh: "寺廟、教堂、宗教機構、靈修教學中心或宗教禮儀場所" },
      { slug: "university", en: "university, college, campus, lecture hall, academic department or research-teaching institution", zh: "大學、學院、校園、演講廳、學術部門或研究教學機構" },
      { slug: "court_legal", en: "court, law office, legal department, immigration office, consulate, embassy or formal advisory setting", zh: "法院、律師樓、法律部門、入境處、領事館、大使館或正式顧問場所" },
      { slug: "publisher", en: "publisher, editorial office, printing house, library, book warehouse or large bookshop", zh: "出版社、編輯部、印刷廠、圖書館、書倉或大型書店" },
      { slug: "corporation", en: "large corporation, headquarters, major institution, large conference venue or expansive workplace", zh: "大企業、總部、大型機構、大型會議場地或寬敞的工作場所" },
      { slug: "bank_wealth", en: "bank, investment office, wealth-management, financial-advisory or a place where significant resources are managed", zh: "銀行、投資機構、財富管理、財務顧問或管理大量資源的地方" },
      { slug: "overseas", en: "airport, an overseas or international area, travel office or place connected to long-distance travel or immigration", zh: "機場、海外或國際區、旅遊機構或與長途旅行或入境相關的地方" },
      { slug: "large_public_room", en: "a large room, broad public area or place where knowledge or opportunity is expanded", zh: "大房間、寬廣的公共區域或擴展知識或機會的地方" },
    ] },
  saturn: { theme_en: "structure, labour, restriction, age, tradition, authority, planning, construction, storage, endurance", theme_zh: "結構、勞動、限制、年歲、傳統、權威、規劃、建造、儲存、堅持",
    context_en: "a lost item → old storage, files, boxes, restricted cabinets, work areas or hard-to-access places; no Saturn speed or malefic nature", context_zh: "遺失物件→舊收納、檔案、箱、受限櫃、工作區或難以到達之處；不談土星速度或凶性",
    related: [
      { slug: "factory_storage", en: "factory, industrial site, production floor, warehouse, storeroom, stockroom or long-term storage", zh: "工廠、工業用地、生產線、倉庫、貯物室、存貨室或長期儲存" },
      { slug: "farm_rural", en: "farm, agricultural land, barn, field, livestock structure or rural work area", zh: "農場、農地、穀倉、田地、牲畜建築或鄉郊工作區" },
      { slug: "government_records", en: "government department, public authority, regulatory office, records office or formal administrative institution", zh: "政府部門、公權力機關、監管機構、檔案處或正式行政機構" },
      { slug: "traditional_company", en: "traditional company, long-established workplace, conservative organisation or senior management area", zh: "傳統公司、老牌工作場所、保守機構或高級管理區" },
      { slug: "construction", en: "construction site, building structure, maintenance area, utility room or service shaft", zh: "建築工地、樓宇結構、維修區、機房或服務豎井" },
      { slug: "archive_locked", en: "archive, filing room, old records, locked cabinet, safe storage, restricted room or seldom-used space", zh: "檔案室、存檔房、舊記錄、上鎖櫃、保險收納、受限房間或甚少使用的空間" },
      { slug: "old_neglected", en: "an old, worn, cold, dark, dry, heavy, neglected, delayed or hard-to-access area", zh: "老舊、殘破、陰冷、黑暗、乾燥、沉重、荒廢、延誤或難以到達的區域" },
      { slug: "duty_confinement", en: "a place of duty, long-term work, pressure, rules, illness or confinement", zh: "職責、長期工作、壓力、規則、疾病或囚禁的地方" },
    ] },
  uranus: { theme_en: "technology, invention, experimentation, electricity, disruption, independence, unconventional systems", theme_zh: "科技、發明、實驗、電力、顛覆、獨立、非常規系統",
    context_en: "'unexpected' must still link to the House setting; no personality words such as rebellious or detached", context_zh: "「意外」仍須連繫宮位環境；不用叛逆、疏離等性格詞",
    related: [
      { slug: "tech_company", en: "technology company, startup, innovation hub, engineering office, computer lab or electronics workshop", zh: "科技公司、初創、創新中心、工程辦公室、電腦實驗室或電子工作坊" },
      { slug: "laboratory", en: "laboratory, testing room, prototype area, R&D facility or experimental workspace", zh: "實驗室、測試室、原型區、研發設施或實驗工作空間" },
      { slug: "observatory", en: "observatory, planetarium, aerospace-space setting or aviation technology area", zh: "天文台、天象館、航天太空場所或航空科技區" },
      { slug: "server_electrical", en: "server room, network cabinet, electrical panel, charging station, smart-device area or near electronic equipment", zh: "伺服器房、網絡櫃、電力配電盤、充電站、智能裝置區或近電子設備" },
      { slug: "astrology_venue", en: "astrology school, consultation room, metaphysical technology platform or astronomy venue", zh: "占星學校、諮詢室、形上學科技平台或天文場地" },
      { slug: "unusual_location", en: "an unusual, recently changed, temporary, unexpected, separated or non-standard location when supported", zh: "在有支持時：不尋常、近期改動、臨時、意外、分離或非標準的位置" },
    ] },
  neptune: { theme_en: "sea, spirituality, music, art, meditation, imagination, dissolution, confusion, substances", theme_zh: "海、靈性、音樂、藝術、冥想、想像、消融、迷惘、物質",
    context_en: "may indicate confusion about placement but must still give practical candidates; no spiritual or deceptive claims unless directly relevant", context_zh: "可表示位置模糊，但仍要給實際候選；除非直接相關，不作靈性或欺瞞聲稱",
    related: [
      { slug: "seaside", en: "seaside, beach, harbour, boat, waterfront, poolside or water-related environment", zh: "海邊、沙灘、港口、船、水岸、泳池邊或與水相關的環境" },
      { slug: "chapel_retreat", en: "church, chapel, spiritual centre, meditation room, retreat, prayer room or sacred quiet place", zh: "教堂、小聖堂、靈修中心、冥想室、靜修所、祈禱室或安靜聖地" },
      { slug: "concert_studio", en: "concert hall, music studio, recording room, rehearsal room, cinema, theatre or artistic-creative space", zh: "音樂廳、音樂工作室、錄音室、排練室、戲院、劇場或藝術創作空間" },
      { slug: "divination_healing", en: "divination venue, spiritual consultation, healing-meditation or dreamwork setting", zh: "占卜場地、靈性諮詢、療癒冥想或夢境工作場所" },
      { slug: "near_liquids", en: "near liquids, drinks, medicine, alcohol, perfume, paint, photographic materials or a container that may leak", zh: "近液體、飲料、藥物、酒精、香水、油漆、攝影材料或可能滲漏的容器" },
      { slug: "misty_concealed", en: "a misty, damp, poorly marked, confusing, cluttered, concealed-by-soft-material or easily overlooked area", zh: "有霧氣、潮濕、標示不清、混亂、雜物堆積、被軟物遮蓋或容易被忽略的區域" },
      { slug: "pharmacy_health", en: "hospital, pharmacy, treatment area or medicine cabinet only with a direct health-substance connection", zh: "只在有直接健康或藥物關聯時：醫院、藥房、治療區或藥櫃" },
    ] },
  pluto: { theme_en: "underground, secrecy, power, crisis, deep research, confinement, destruction and renewal, hidden control", theme_zh: "地下、隱秘、權力、危機、深入研究、囚禁、破壞與更新、隱藏控制",
    context_en: "no criminality, death or danger from Pluto alone; narrow 'hidden' using the House and Element", context_zh: "單憑冥王星不作犯罪、死亡或危險；用宮位與元素收窄「隱藏」",
    related: [
      { slug: "basement_tunnel", en: "basement, cellar, underground level, tunnel, buried-covered area or the deepest part of storage", zh: "地下室、地窖、地下層、隧道、埋藏或被覆蓋的區域，或收納最深處" },
      { slug: "restricted_secure", en: "prison, detention area, restricted zone, secure facility or a place inaccessible without permission", zh: "監獄、拘留區、限制區、保安設施或未經許可不能進入的地方" },
      { slug: "research_confidential", en: "research institution, forensic laboratory, psychology-research room, investigation office or confidential records", zh: "研究機構、法證實驗室、心理研究室、調查辦公室或機密記錄" },
      { slug: "safe_concealed", en: "safe, locked box, locked drawer, secure cabinet, concealed compartment, private archive or secret storage", zh: "保險箱、上鎖盒、上鎖抽屜、保安櫃、隱藏間格、私人檔案或秘密收納" },
      { slug: "waste_demolition", en: "waste, disposal, recycling, renovation, demolition or contaminated area when loss-destruction is relevant", zh: "在涉及損失或破壞時：廢物、棄置、回收、翻新、拆卸或受污染的區域" },
      { slug: "crisis_control", en: "a place of crisis management, control systems, confidential information, birth-death services or deep transformation", zh: "危機管理、控制系統、機密資訊、生死服務或深層轉化的地方" },
      { slug: "behind_beneath_inside", en: "behind, beneath or inside another object when the House and context support concealment", zh: "在宮位與情境支持隱藏時：在另一物件的後方、下方或內部" },
    ] },
  north_node: { theme_en: "growth, learning, progress, new direction, future development, unfamiliar opportunity", theme_zh: "成長、學習、進步、新方向、未來發展、陌生機會",
    context_en: "not automatically far (the House decides); 'new place' needs support", context_zh: "不自動屬遠（由宮位決定）；「新地方」需要支持",
    related: [
      { slug: "academy", en: "academy, school, training centre, classroom, workshop or coaching-development space", zh: "學院、學校、培訓中心、課室、工作坊或指導發展空間" },
      { slug: "development_venue", en: "university, educational institution, professional-development venue or a place to acquire a new skill", zh: "大學、教育機構、專業發展場地或學習新技能的地方" },
      { slug: "overseas_new", en: "an overseas or foreign place, immigration-travel setting, international organisation or cross-cultural environment", zh: "海外或外地、入境旅行場所、國際組織或跨文化環境" },
      { slug: "new_workplace", en: "a new workplace, newly opened room, new route, unfamiliar destination or next-stage place", zh: "新工作地點、新開的房間、新路線、陌生目的地或下一階段的地方" },
      { slug: "orientation_area", en: "an orientation area, admissions office, career-development office or place where future plans are prepared", zh: "迎新區、報名處、職業發展辦公室或準備未來計劃的地方" },
    ] },
  south_node: { theme_en: "the past, old habits, release, return, previous use, ancestry, what has been left behind", theme_zh: "過去、舊習慣、放下、回歸、曾經使用、祖源、被留下之物",
    context_en: "old, familiar or previous, not 'lost forever'; no fixed malefic nature in Location", context_zh: "舊有、熟悉或曾經，不是「永遠遺失」；地點模式不設固定凶性",
    related: [
      { slug: "old_home", en: "an old home, former residence, parents'-family's old home, ancestral place or childhood place", zh: "舊居、前住所、父母或家人的舊居、祖屋或童年地方" },
      { slug: "heritage_site", en: "a historical building, heritage site, museum-archive of old material or traditional site", zh: "歷史建築、文物古蹟、舊物博物館或檔案，或傳統場所" },
      { slug: "previous_workplace", en: "a previous workplace, former classroom, old shop, former route or place previously used", zh: "從前的工作地點、舊課室、舊店、舊路線或曾經使用的地方" },
      { slug: "old_storage", en: "storage for old belongings, inherited items, old documents, keepsakes, unused furniture or items to discard", zh: "存放舊物、承繼物品、舊文件、紀念品、閒置傢俬或待棄物品的地方" },
      { slug: "attic_forgotten", en: "attic, spare room, back cupboard, old box, forgotten bag, disused corner or an area not checked for a long time", zh: "閣樓、雜物房、後櫃、舊箱、被遺忘的袋、棄用角落或久未查看的區域" },
      { slug: "clearing_out", en: "a place of returning, reviewing, clearing out, releasing or finishing the past", zh: "回歸、回顧、清理、放下或結束過去的地方" },
    ] },
});

export const LOCATION_HOUSE_BANK: Readonly<Record<number, LocationHouseBank>> = Object.freeze({
  1: { setting_en: "the questioner, own space, body/person, immediate surroundings, own group/team", setting_zh: "問卜者、自己的空間、身體或本人、眼前環境、自己的群組",
    context_en: "House 1 is not 'head'; body-part data is excluded", context_zh: "第一宮不是「頭部」；不使用身體部位資料",
    related: [
      { slug: "on_questioner", en: "on the questioner, in clothing, a pocket, wallet, handbag, backpack or a carried item", zh: "在問卜者身上、衣物、口袋、銀包、手袋、背包或隨身物品" },
      { slug: "current_room", en: "the current room, own desk, chair, bedside area, personal drawer, locker or workstation", zh: "現在的房間、自己的書桌、椅、床邊、私人抽屜、儲物櫃或工作位" },
      { slug: "own_controlled", en: "own home, office, vehicle, own side of a shared room or a place under the questioner's control", zh: "自己的家、辦公室、車輛、共用房間中屬於自己的一邊，或由問卜者控制的地方" },
      { slug: "within_reach", en: "immediately nearby, within reach, near the entrance-current position or the first place normally checked", zh: "就在附近、伸手可及、近入口或當前位置，或通常最先查看的地方" },
      { slug: "own_team_area", en: "a team, group or shared area directly representing the questioner", zh: "直接代表問卜者的團隊、群組或共用區域" },
    ] },
  2: { setting_en: "money, movable possessions, valuables, income, resources, personal financial support", setting_zh: "金錢、可移動財物、貴重物、收入、資源、個人財務支持",
    context_en: "resource, valuables and money-holding places", context_zh: "存放資源、貴重物與金錢的地方",
    related: [
      { slug: "bank_finance", en: "bank, cash counter, finance office, payment area or safe-deposit", zh: "銀行、收銀處、財務室、付款區或保管箱" },
      { slug: "wallet_safe", en: "wallet, purse, cash box, safe, valuables cabinet, jewellery storage, asset file or money drawer", zh: "銀包、錢包、錢箱、保險箱、貴重物櫃、首飾收納、資產檔案或錢抽屜" },
      { slug: "personal_storage", en: "personal storage, wardrobe, cupboard, shelf, inventory or stock area", zh: "個人收納、衣櫃、櫥櫃、架、存貨或貨倉區" },
      { slug: "revenue_area", en: "a workplace area handling revenue, accounts, cash, invoices or valuables", zh: "處理收入、帳目、現金、發票或貴重物的工作區" },
      { slug: "supporter_resource", en: "a supporter's or ally's resource area", zh: "支持者或盟友的資源區" },
    ] },
  3: { setting_en: "communication, documents, messages, short travel, siblings, relatives, neighbours, local community", setting_zh: "溝通、文件、訊息、短途、兄弟姊妹、親戚、鄰居、本地社區",
    context_en: "House 3 distance is fixed 'far': render it as 'outside the immediate personal space, in the nearby movement/communication environment'", context_zh: "第三宮距離固定為「遠」：表述為「離開眼前的個人空間，在附近的走動或通訊環境」",
    related: [
      { slug: "nearby_street", en: "a nearby street, corridor, lobby, lift area, building common area, local shop, neighbourhood or neighbour's place", zh: "附近的街道、走廊、大堂、電梯區、樓宇公共區、就近商店、街坊或鄰居的地方" },
      { slug: "short_transport", en: "bus stop, station, taxi, vehicle, bicycle area, parking-transport interchange or short-trip route", zh: "巴士站、車站、的士、車輛、單車區、停車或轉乘處，或短途路線" },
      { slug: "desk_mail", en: "desk, mailbox, post area, courier, printer, filing area, newspaper-magazine area or comms equipment", zh: "書桌、信箱、郵寄區、速遞、打印機、存檔區、報章雜誌區或通訊設備" },
      { slug: "local_contact", en: "a sibling's, relative's, neighbour's, colleague's or local contact's space", zh: "兄弟姊妹、親戚、鄰居、同事或本地聯絡人的空間" },
      { slug: "commute_bag", en: "a bag or container for commuting, errands, documents or daily communication", zh: "用於通勤、辦事、文件或日常通訊的袋或容器" },
    ] },
  4: { setting_en: "home, parents (esp. father), family, ancestors, property, land, private foundations, below-ground/hidden domestic space", setting_zh: "家、父母（尤其父親）、家人、祖先、物業、土地、私密根基、地下或隱蔽的家居空間",
    context_en: "vs House 12, House 4 stays connected to home, family, land or the private household — usually a usable search context, not isolation", context_zh: "相對第十二宮，第四宮仍連繫家、家人、土地或私人家居——通常是可搜尋的情境，而非隔離",
    related: [
      { slug: "family_property", en: "the questioner's, parents', family or ancestral home or property", zh: "問卜者、父母、家人或祖先的家或物業" },
      { slug: "household_room", en: "bedroom, living or family room, a private household room, family storage, important-document storage or a place only household members use", zh: "睡房、客廳或家庭房、私人家居房間、家庭收納、重要文件收納，或只有家庭成員使用的地方" },
      { slug: "under_furniture", en: "basement, cellar, under-floor, low cupboard, bottom shelf, under furniture, inside a fixed household cabinet or a private hidden corner", zh: "地下室、地窖、地板下、矮櫃、底層、傢俬下方、固定家居櫃內或私人隱蔽角落" },
      { slug: "garden_land", en: "garden, yard, land, farm, soil area, attached garage or property boundary", zh: "花園、庭院、土地、農場、泥土區、附連車庫或物業邊界" },
      { slug: "family_records", en: "near family records, property documents, photographs, heirlooms, household archives or parents' possessions", zh: "近家庭記錄、物業文件、相片、傳家物、家居檔案或父母的物品" },
    ] },
  5: { setting_en: "entertainment, games, pleasure, sport, creativity, pregnancy, children, social enjoyment", setting_zh: "娛樂、遊戲、愉悅、運動、創作、懷孕、子女、社交享受",
    context_en: "recreation and creative places", context_zh: "消遣與創作的地方",
    related: [
      { slug: "playground", en: "playground, children's room, nursery play area or school activity room", zh: "遊樂場、兒童房、育嬰遊戲區或學校活動室" },
      { slug: "gym_recreation", en: "gym, sports field, stadium, game room, recreation centre, club or hobby area", zh: "健身室、運動場、體育館、遊戲室、康樂中心、會所或興趣區" },
      { slug: "theatre_party", en: "theatre, cinema, concert venue, performance space, party venue, bar, celebration or amusement venue", zh: "劇院、戲院、音樂會場地、表演空間、派對場地、酒吧、慶祝或遊樂場地" },
      { slug: "craft_hobby", en: "art-craft room, music room, creative studio, hobby desk, toy storage, game storage or leisure shelf", zh: "美術手作室、音樂室、創作工作室、興趣書桌、玩具收納、遊戲收納或休閒架" },
      { slug: "romantic_place", en: "a romantic-date or pleasure place when directly relevant", zh: "在直接相關時：浪漫約會或享樂的地方" },
    ] },
  6: { setting_en: "work, service, employees, routine duties, illness, clinics, animals and maintenance", setting_zh: "工作、服務、員工、日常職責、疾病、診所、動物與維修",
    context_en: "workplace, service and maintenance areas", context_zh: "工作、服務與維修的地方",
    related: [
      { slug: "office_routine", en: "office, workstation, staff room, service counter, back office, operations or routine-work area", zh: "辦公室、工作位、員工室、服務櫃檯、後勤、營運或例行工作區" },
      { slug: "clinic", en: "clinic, medical office, treatment room, pharmacy, medicine cabinet, health-service area or sick room", zh: "診所、醫務所、治療室、藥房、藥櫃、健康服務區或病房" },
      { slug: "animal_area", en: "pet area, kennel, animal clinic, stable, livestock area, farm-service or animal-supply storage", zh: "寵物區、狗舍、動物診所、馬廄、牲畜區、農務服務或動物用品儲存" },
      { slug: "maintenance", en: "cleaning cupboard, utility area, maintenance room, laundry, staff storage or tool-supply cabinet", zh: "清潔櫃、雜物區、維修房、洗衣、員工儲存或工具用品櫃" },
      { slug: "employee_area", en: "an employee's, assistant's, service provider's or subordinate's work area", zh: "員工、助理、服務提供者或下屬的工作區" },
    ] },
  7: { setting_en: "another person, partner, counterpart, opponent, adviser, doctor, astrologer, or destination", setting_zh: "另一人、伴侶、對方、對手、顧問、醫生、占星師，或目的地",
    context_en: "the other side or an agreed destination", context_zh: "對方的一邊或約定的目的地",
    related: [
      { slug: "destination", en: "the intended destination, arrival point, delivery address, meeting point or place travelled to", zh: "目的地、抵達點、送遞地址、會面點或前往的地方" },
      { slug: "counterpart_place", en: "a partner's, spouse's, client's, customer's, adviser's, doctor's, astrologer's, opponent's or counterpart's place", zh: "伴侶、配偶、客戶、顧客、顧問、醫生、占星師、對手或對方的地方" },
      { slug: "meeting_room", en: "meeting room, consultation room, negotiation table, reception, contract-signing place or one-to-one space", zh: "會議室、諮詢室、談判桌、接待處、簽約地點或一對一空間" },
      { slug: "other_side", en: "the other side of a shared space, a place facing the questioner or an area controlled by another person", zh: "共用空間的對面、面向問卜者的地方，或由他人控制的區域" },
      { slug: "exchange_place", en: "a place of exchange, handover, appointment, agreement or confrontation", zh: "交換、交收、約會、協議或對質的地方" },
    ] },
  8: { setting_en: "danger, loss, decay, inheritance, partner's money, debt, loans, tax, fear, confidential financial matters", setting_zh: "危險、損失、腐朽、遺產、伴侶的金錢、債務、貸款、稅務、恐懼、機密財務",
    context_en: "shared-resource and confidential-financial places; a fear place only if it also fits the physical evidence", context_zh: "共享資源與機密財務的地方；只有在也符合物理證據時才用恐懼場所",
    related: [
      { slug: "bank_tax", en: "bank, loan office, debt-credit department, tax office, treasury, insurance claims or financial records", zh: "銀行、貸款處、債務信貸部、稅局、庫房、保險索償或財務記錄" },
      { slug: "others_money", en: "a place where another's money or shared assets are kept", zh: "存放他人金錢或共享資產的地方" },
      { slug: "estate_archive", en: "safe, locked financial cabinet, inheritance-will file, confidential account archive or estate-document storage", zh: "保險箱、上鎖財務櫃、遺產遺囑檔案、機密帳戶檔案或遺產文件收納" },
      { slug: "decaying_waste", en: "a dangerous, damaged, decaying, waste, disposal, recycling, sewage or contaminated area", zh: "危險、受損、腐朽、廢物、棄置、回收、污水或受污染的區域" },
      { slug: "crisis_setting", en: "an emergency, crisis, mortuary-funeral or loss setting only when directly relevant", zh: "只在直接相關時：緊急、危機、殮房殯儀或損失場所" },
      { slug: "fear_place", en: "a place of fear or avoidance only if it also fits the physical evidence", zh: "只有在也符合物理證據時：令人恐懼或迴避的地方" },
    ] },
  9: { setting_en: "long travel, foreign places, religion, philosophy, language, higher education, law, guidance, publishing", setting_zh: "遠行、外地、宗教、哲學、語言、高等教育、法律、指導、出版",
    context_en: "far, foreign or higher-knowledge places", context_zh: "遠方、外地或高等知識的地方",
    related: [
      { slug: "university_guidance", en: "university, college, lecture hall, academic library, research-teaching, language school or counselling-guidance office", zh: "大學、學院、演講廳、學術圖書館、研究教學、語言學校或輔導指導辦公室" },
      { slug: "publisher_knowledge", en: "publisher, editorial office, printing house, large bookstore or formal knowledge distribution", zh: "出版社、編輯部、印刷廠、大型書店或正式知識發佈" },
      { slug: "law_court", en: "law office, court, tribunal, legal-advice centre, government legal office or document-certification office", zh: "律師樓、法院、審裁處、法律諮詢中心、政府法律辦公室或文件認證處" },
      { slug: "religious_venue", en: "church, temple, monastery, religious school, spiritual-teaching venue or pilgrimage place", zh: "教堂、寺廟、修道院、宗教學校、靈修教學場地或朝聖地" },
      { slug: "airport_abroad", en: "airport, port, travel office, overseas destination, hotel abroad, embassy, consulate, immigration office or international organisation", zh: "機場、港口、旅遊機構、海外目的地、外地酒店、大使館、領事館、入境處或國際組織" },
      { slug: "long_route", en: "a long-distance transport route or major-journey place", zh: "長途交通路線或重大旅程的地方" },
    ] },
  10: { setting_en: "career, status, reputation, authority, boss, management, mother, profit, achievement", setting_zh: "事業、地位、名聲、權威、上司、管理、母親、利潤、成就",
    context_en: "workplace-of-standing and public-recognition places", context_zh: "有地位的工作場所與公眾認可的地方",
    related: [
      { slug: "company_office", en: "workplace, company office, headquarters, executive floor, manager's office, boardroom, government-leadership office or professional institution", zh: "工作場所、公司辦公室、總部、行政樓層、經理室、會議室、政府領導辦公室或專業機構" },
      { slug: "public_reputation", en: "a public-facing place of reputation, recognition, achievement, promotion, awards or official responsibility", zh: "與名聲、認可、成就、晉升、頒獎或正式責任相關的對外場所" },
      { slug: "strategy_area", en: "a business-development, sales, profit, strategy, leadership or decision-making area", zh: "業務發展、銷售、利潤、策略、領導或決策區" },
      { slug: "authority_place", en: "the boss's, supervisor's, director's, public authority's or mother's place", zh: "上司、主管、董事、公權力或母親的地方" },
      { slug: "public_platform", en: "a formal event, conference, ceremony, public platform or place where professional standing is displayed", zh: "正式活動、會議、典禮、公開平台或展示專業地位的地方" },
    ] },
  11: { setting_en: "friends, social circles, allies, helpers, organisations, associations, unions, hopes and plans", setting_zh: "朋友、社交圈、盟友、幫手、組織、協會、工會、願望與計劃",
    context_en: "group, community and helper places", context_zh: "群體、社群與幫手的地方",
    related: [
      { slug: "social_venue", en: "a friend's home, social gathering place, club, association, society, union office, community group or networking venue", zh: "朋友的家、社交聚會地點、會所、協會、社團、工會辦公室、社區團體或聯誼場地" },
      { slug: "group_space", en: "a team space, group meeting room, volunteer organisation, NGO, professional association or membership venue", zh: "團隊空間、小組會議室、義工組織、非政府組織、專業協會或會員場地" },
      { slug: "community_centre", en: "a café, event venue, party space, shared hobby location or community centre", zh: "咖啡店、活動場地、派對空間、共同興趣地點或社區中心" },
      { slug: "online_community", en: "online-community equipment or a group communications area only for a digital item or account", zh: "只針對數碼物品或帳戶：網上社群設備或群組通訊區" },
      { slug: "ally_space", en: "a helper's, supporter's, colleague's or ally's space", zh: "幫手、支持者、同事或盟友的空間" },
    ] },
  12: { setting_en: "secrecy, concealed matters, confinement, isolation, restriction, hospitals, monasteries, hidden enemies, self-undoing, difficulty recovering what is lost", setting_zh: "隱秘、隱藏事務、囚禁、隔離、限制、醫院、修道院、暗中的敵人、自我破壞、難以尋回遺失之物",
    context_en: "vs House 4, House 12 more strongly indicates deeply concealed, inaccessible, overlooked or institutional-isolated — but never 'will never be found'", context_zh: "相對第四宮，第十二宮更強指深藏、難以到達、被忽略或機構隔離——但絕不「永不會找到」",
    related: [
      { slug: "institution_isolated", en: "hospital, care institution, retreat, monastery, prison, detention-restricted area or isolated room", zh: "醫院、護理機構、靜修所、修道院、監獄、拘留限制區或隔離房間" },
      { slug: "locked_hidden", en: "a locked room, inaccessible storage, concealed compartment, back room, private archive, hidden cupboard or place not normally entered", zh: "上鎖房間、難以進入的收納、隱藏間格、後房、私人檔案、隱藏櫃或不常進入的地方" },
      { slug: "sealed_beneath", en: "behind furniture, inside another container, beneath stored items or in a sealed bag-box or mixed into forgotten storage", zh: "傢俬後方、另一容器內、堆放物品之下，或封好的袋盒中，或混入被遺忘的收納" },
      { slug: "deliberately_hidden", en: "a place where the item was deliberately hidden, accidentally enclosed, removed from circulation or left behind without awareness", zh: "物品被刻意收藏、意外封入、移離流通或在無意識下留下的地方" },
      { slug: "lost_property", en: "a lost-property office, institutional storage, long-term storage or place controlled by others and hard to access", zh: "失物認領處、機構儲存、長期儲存，或由他人控制而難以到達的地方" },
      { slug: "hard_to_recover", en: "a location genuinely difficult to identify or recover from", zh: "真正難以辨認或尋回的位置" },
    ] },
});
