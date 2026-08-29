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

/* ---------------- Sign essence / detail (Level-1 injected values, §10 / Appendix H) ----------------
 * Libra / Virgo / Sagittarius are the Appendix-H controlling verbatim strings; the
 * remaining nine follow the same concise sign-essence style (reviewing-AI expansion,
 * as with the Location bank). Used ONLY to build the Level-1 `given` envelope. */
export type SignEssenceRow = Readonly<{ essence_en: string; detail_en: string; essence_zh: string; detail_zh: string }>;
export const SIGN_ESSENCE: Readonly<Record<DiceV05SignId, SignEssenceRow>> = Object.freeze({
  aries: { essence_en: "Initiative and direct action", detail_en: "Courage, drive and starting things", essence_zh: "主動與直接行動", detail_zh: "勇氣、衝勁、開創" },
  taurus: { essence_en: "Stability and material steadiness", detail_en: "Patience, comfort and lasting value", essence_zh: "穩定與務實踏實", detail_zh: "耐性、安穩、持久價值" },
  gemini: { essence_en: "Communication and curiosity", detail_en: "Ideas, exchange and quick learning", essence_zh: "溝通與好奇", detail_zh: "思想、交流、快速學習" },
  cancer: { essence_en: "Care and emotional security", detail_en: "Home, nurture and belonging", essence_zh: "照顧與情感安全", detail_zh: "家庭、養育、歸屬" },
  leo: { essence_en: "Self-expression and confidence", detail_en: "Creativity, warmth and leadership", essence_zh: "自我表達與自信", detail_zh: "創造、熱情、領導" },
  virgo: { essence_en: "Practical analysis and attention to detail", detail_en: "Planning, refinement and careful checking", essence_zh: "重視細節與實際分析", detail_zh: "規劃、修正、仔細檢查" },
  libra: { essence_en: "Balance and relationship coordination", detail_en: "Cooperation, negotiation and aesthetics", essence_zh: "平衡、協調關係", detail_zh: "合作、談判、美感" },
  scorpio: { essence_en: "Depth and intensity", detail_en: "Focus, transformation and control", essence_zh: "深度與強烈", detail_zh: "專注、轉化、掌控" },
  sagittarius: { essence_en: "Meaning, breadth and exploration", detail_en: "Higher learning, travel, philosophy and the big picture", essence_zh: "意義、廣度與探索", detail_zh: "高等學習、旅行、哲學與大局" },
  capricorn: { essence_en: "Structure and ambition", detail_en: "Discipline, responsibility and long-term goals", essence_zh: "結構與企圖心", detail_zh: "紀律、責任、長遠目標" },
  aquarius: { essence_en: "Independence and innovation", detail_en: "Ideas, groups and the unconventional", essence_zh: "獨立與創新", detail_zh: "理念、群體、非常規" },
  pisces: { essence_en: "Sensitivity and imagination", detail_en: "Compassion, dreams and dissolution", essence_zh: "敏感與想像", detail_zh: "慈悲、夢想、消融" },
});

// Element direction/place — the ONLY Sign-derived location clue (manual §5 / §6.4).
export const ELEMENT_TABLE: Readonly<Record<DiceV05Element, Readonly<{ direction: string; places_en: readonly string[]; places_zh: readonly string[] }>>> = Object.freeze({
  Fire: { direction: "East", places_en: ["near heat or fire", "chimney", "near an exterior wall"], places_zh: ["靠近熱源或火", "煙囪", "鄰近房屋圍牆"] },
  Earth: { direction: "South", places_en: ["road or ground", "near earth, mud or clay", "basement"], places_zh: ["路面或地面", "接近泥或黏土", "地下室"] },
  Air: { direction: "West", places_en: ["a high or open place", "upper room or floor", "near roof or window"], places_zh: ["高或視野廣闊的地方", "房屋中上層", "接近屋頂或窗戶"] },
  Water: { direction: "North", places_en: ["near water", "bathroom or kitchen", "a damp place, pool, pond or river"], places_zh: ["靠近水", "浴室或廚房", "潮濕地方、水池、池塘或河流"] },
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

/* ---------------- Location bank (Appendix C; complete normalized transcription) ----------------
 * Each entry carries the controlled theme/setting, the controlled related places,
 * and a context rule. Wire keys (§16): theme=pt, context=pc, related=p1..pN
 * (planet); setting=hs, context=hc, related=h1..hN (house); element places e1..eN.
 * The stable global id (gid) scheme is planet.<id>.(theme|context|related.<i>),
 * house.<n>.(setting|context|related.<i>), element.<element>.<i>. */
export type LocationPlanetBank = Readonly<{ theme_en: string; theme_zh: string; context_en: string; context_zh: string; related_en: readonly string[]; related_zh: readonly string[] }>;
export type LocationHouseBank = Readonly<{ setting_en: string; setting_zh: string; context_en: string; context_zh: string; related_en: readonly string[]; related_zh: readonly string[] }>;

export const LOCATION_PLANET_BANK: Readonly<Record<DiceV05PlanetId, LocationPlanetBank>> = Object.freeze({
  sun: { theme_en: "prominence, leadership, authority, visibility, centrality, performance, recognition", theme_zh: "顯赫、領導、權威、可見、核心、表演、認可",
    context_en: "central, visible, important, displayed or official-work area before obscure storage; do not convert Sun into a Fire direction unless the Sign is Fire", context_zh: "先看核心、顯眼、重要、展示或正式工作的地方，其次才是隱蔽收納；除非星座屬火，否則不要把太陽當成火方位",
    related_en: ["a leader's, manager's or owner's office; executive or command area", "a stage, studio, presentation or reception area", "a central or focal part of a room, workplace or venue", "a display shelf, trophy or place where important items are deliberately presented"],
    related_zh: ["領導、經理或負責人的辦公室；行政或指揮區", "舞台、工作室、簡報或接待區", "房間、工作場所或場地的中心或焦點位置", "陳列架、獎座或刻意展示重要物品的地方"] },
  moon: { theme_en: "home, family, domestic life, care, food, nourishment, water, night, everyday household security", theme_zh: "家庭、家人、居家、照顧、食物、滋養、水、夜間、日常家居保障",
    context_en: "if last handled at home, indicate bedroom, living, dining, kitchen or family storage; no emotional or personality commentary", context_zh: "若最後在家中處理，指向睡房、客廳、飯廳、廚房或家庭收納；不作情緒或性格評論",
    related_en: ["the questioner's or a family member's home; bedroom, living or family room, private domestic area", "kitchen, dining, pantry or food-service area", "familiar household storage chosen for safekeeping", "a place used more at night or in a domestic routine"],
    related_zh: ["問卜者或家人的家；睡房、客廳或家庭房、私人居家空間", "廚房、飯廳、儲物間或供餐區", "為安全收藏而選的熟悉家居收納", "較常在夜間或日常家居流程使用的地方"] },
  mercury: { theme_en: "information, documents, writing, learning, communication, movement, short travel, transactions, devices", theme_zh: "資訊、文件、書寫、學習、溝通、走動、短途、交易、裝置",
    context_en: "documents or travel papers go to document storage, a work-study desk, a bag, a vehicle or transit; not 'a communicative person'", context_zh: "文件或旅行證件會在文件收納、工作或讀書的書桌、袋、車輛或交通位置；不是「一個健談的人」",
    related_en: ["school, classroom, library, bookstore, study or training room", "desk, stationery, document cabinet, filing area, mailroom or office communications", "near books, notebooks, letters, forms, receipts, tickets, passports or identification", "near a phone, computer, tablet, router, charger or comms device", "a bus stop, station, transit, vehicle, bicycle area or short-trip bag"],
    related_zh: ["學校、課室、圖書館、書店、自修或訓練室", "書桌、文具、文件櫃、存檔區、收發室或辦公室通訊", "近書本、筆記、信件、表格、收據、車票、護照或證件", "近電話、電腦、平板、路由器、充電器或通訊裝置", "巴士站、車站、轉乘、車輛、單車區或短途袋"] },
  venus: { theme_en: "beauty, art, pleasure, harmony, shopping, adornment, relationships, music, celebration", theme_zh: "美、藝術、愉悅、和諧、購物、裝飾、關係、音樂、慶祝",
    context_en: "jewellery, cosmetics, clothes, gifts or art go to their relevant storage or display; don't infer 'luxury' without support", context_zh: "首飾、化妝品、衣物、禮物或藝術品放在相關收納或展示處；沒有支持不要推斷「奢華」",
    related_en: ["gallery, studio, craft, design or music venue", "garden, florist, park or decorative outdoor area", "shop, boutique, department store, gift or jewellery store", "beauty salon, dressing room, wardrobe, vanity, jewellery box or accessory drawer"],
    related_zh: ["畫廊、工作室、手作、設計或音樂場地", "花園、花店、公園或裝飾性戶外區", "商店、精品店、百貨、禮品或珠寶店", "美容院、更衣室、衣櫃、梳妝台、首飾盒或飾物抽屜"] },
  mars: { theme_en: "action, heat, force, competition, sport, tools, cutting, conflict, machinery", theme_zh: "行動、熱、力量、競爭、運動、工具、切割、衝突、機械",
    context_en: "phrase any danger cautiously; no emergency claim from Mars alone; a fire or heat direction needs a Fire Sign", context_zh: "任何危險都要謹慎表述；單憑火星不作緊急聲稱；火或熱的方位需配火象星座",
    related_en: ["gym, sports field, training or competition venue", "workshop, garage, repair, tool or machinery area", "kitchen work area when knives, cutting or heat are relevant", "near sharp tools, blades, sports equipment or heating equipment"],
    related_zh: ["健身室、運動場、訓練或比賽場地", "工作坊、車房、維修、工具或機械區", "涉及刀具、切割或熱力時的廚房工作區", "近利器、刀刃、運動器材或加熱設備"] },
  jupiter: { theme_en: "higher learning, religion, law, publishing, expansion, wealth, large institutions, overseas affairs", theme_zh: "高等學習、宗教、法律、出版、擴展、財富、大型機構、海外事務",
    context_en: "choose among education, law, religion, publishing, finance, corporate or overseas by the question; distance comes from the House", context_zh: "按問題在教育、法律、宗教、出版、財務、企業或海外之間選擇；距離由宮位決定",
    related_en: ["temple, church, religious institution or teaching centre", "university, campus, lecture hall or academic department", "court, law office, immigration, consulate or embassy", "publisher, printing house, library or large bookshop", "bank, investment office or place where significant resources are managed"],
    related_zh: ["寺廟、教堂、宗教機構或教學中心", "大學、校園、演講廳或學術部門", "法院、律師樓、入境處、領事館或大使館", "出版社、印刷廠、圖書館或大型書店", "銀行、投資機構或管理大量資源的地方"] },
  saturn: { theme_en: "structure, labour, restriction, age, tradition, authority, planning, construction, storage, endurance", theme_zh: "結構、勞動、限制、年歲、傳統、權威、規劃、建造、儲存、堅持",
    context_en: "a lost item goes to old storage, files, boxes, restricted cabinets, work areas or hard-to-access places; no Saturn speed or malefic nature", context_zh: "遺失物件在舊收納、檔案、箱、受限櫃、工作區或難以到達之處；不談土星速度或凶性",
    related_en: ["factory, industrial site, warehouse or long-term storage", "farm, agricultural land or rural work area", "government or regulatory office or records office", "archive, filing room, locked cabinet, safe or restricted room", "an old, cold, dark, heavy, neglected or hard-to-access area"],
    related_zh: ["工廠、工業用地、倉庫或長期儲存", "農場、農地或鄉郊工作區", "政府或監管機構、檔案處", "檔案室、存檔房、上鎖櫃、保險箱或受限房間", "老舊、陰冷、黑暗、沉重、荒廢或難以到達的區域"] },
  uranus: { theme_en: "technology, invention, experimentation, electricity, disruption, independence, unconventional systems", theme_zh: "科技、發明、實驗、電力、顛覆、獨立、非常規系統",
    context_en: "'unexpected' must still link to the House setting; no personality words such as rebellious or detached", context_zh: "「意外」仍須連繫宮位環境；不用叛逆、疏離等性格詞",
    related_en: ["technology company, startup, engineering office or computer lab", "laboratory, testing, prototype or R&D area", "server room, network cabinet, electrical panel or near electronic equipment", "an unusual, recently changed, temporary or non-standard location when supported"],
    related_zh: ["科技公司、初創、工程辦公室或電腦實驗室", "實驗室、測試、原型或研發區", "伺服器房、網絡櫃、電力配電盤或近電子設備", "在有支持時：不尋常、近期改動、臨時或非標準的位置"] },
  neptune: { theme_en: "sea, spirituality, music, art, meditation, imagination, dissolution, confusion, substances", theme_zh: "海、靈性、音樂、藝術、冥想、想像、消融、迷惘、物質",
    context_en: "may indicate confusion about placement but must still give practical candidates; no spiritual or deceptive claims unless directly relevant", context_zh: "可表示位置模糊，但仍要給實際候選；除非直接相關，不作靈性或欺瞞聲稱",
    related_en: ["seaside, harbour, waterfront or poolside", "church, chapel, meditation room, retreat or quiet sacred place", "concert hall, music studio, recording room, cinema or theatre", "near liquids, drinks, medicine, perfume, paint or a container that may leak"],
    related_zh: ["海邊、碼頭、水岸或泳池邊", "教堂、小聖堂、冥想室、靜修或安靜聖地", "音樂廳、音樂工作室、錄音室、戲院或劇場", "近液體、飲料、藥物、香水、油漆或可能滲漏的容器"] },
  pluto: { theme_en: "underground, secrecy, power, crisis, deep research, confinement, destruction and renewal, hidden control", theme_zh: "地下、隱秘、權力、危機、深入研究、囚禁、破壞與更新、隱藏控制",
    context_en: "no criminality, death or danger from Pluto alone; narrow 'hidden' using House and Element", context_zh: "單憑冥王星不作犯罪、死亡或危險；用宮位與元素收窄「隱藏」",
    related_en: ["basement, cellar, underground level, tunnel or the deepest part of storage", "a secure, restricted or permission-only place", "safe, locked box or drawer, concealed compartment or private archive", "behind, beneath or inside another object when House and context support concealment"],
    related_zh: ["地下室、地窖、地下層、隧道或收納最深處", "保安、受限或需許可才能進入的地方", "保險箱、上鎖盒或抽屜、隱藏間格或私人檔案", "在宮位與情境支持隱藏時：在另一物件的後方、下方或內部"] },
  north_node: { theme_en: "growth, learning, progress, new direction, future development, unfamiliar opportunity", theme_zh: "成長、學習、進步、新方向、未來發展、陌生機會",
    context_en: "not automatically far (the House decides); 'new place' needs support", context_zh: "不自動屬遠（由宮位決定）；「新地方」需要支持",
    related_en: ["academy, training centre, classroom or development space", "a place to acquire a new skill or professional development venue", "a new workplace, newly opened room, new route or next-stage place", "an orientation or admissions area where future plans are prepared"],
    related_zh: ["學院、培訓中心、課室或發展空間", "學習新技能的地方或專業發展場地", "新工作地點、新開的房間、新路線或下一階段的地方", "準備未來計劃的迎新或報名區"] },
  south_node: { theme_en: "the past, old habits, release, return, previous use, ancestry, what has been left behind", theme_zh: "過去、舊習慣、放下、回歸、曾經使用、祖源、被留下之物",
    context_en: "old, familiar or previous, not 'lost forever'; no fixed malefic nature in Location", context_zh: "舊有、熟悉或曾經，不是「永遠遺失」；地點模式不設固定凶性",
    related_en: ["an old home, former residence, ancestral or childhood place", "a heritage site, museum or archive of old material", "a previous workplace, former classroom, old shop or route", "storage for old belongings, keepsakes or unused furniture; an attic, back cupboard or long-unchecked corner"],
    related_zh: ["舊居、前住所、祖屋或童年地方", "古蹟、博物館或舊物檔案", "從前的工作地點、舊課室、舊店或舊路線", "存放舊物、紀念品或閒置傢俬的地方；閣樓、後櫃或久未查看的角落"] },
});

export const LOCATION_HOUSE_BANK: Readonly<Record<number, LocationHouseBank>> = Object.freeze({
  1: { setting_en: "the questioner, own space, body/person, immediate surroundings, own group/team", setting_zh: "問卜者、自己的空間、身體或本人、眼前環境、自己的群組",
    context_en: "House 1 is not 'head'; body-part data is excluded", context_zh: "第一宮不是「頭部」；不使用身體部位資料",
    related_en: ["on the questioner, in clothing, pocket, wallet, handbag, backpack or a carried item", "the current room, own desk, chair, bedside area, personal drawer or workstation", "own home, office, vehicle or own side of a shared space", "immediately nearby, within reach or the first place normally checked"],
    related_zh: ["在問卜者身上、衣物、口袋、銀包、手袋、背包或隨身物品", "現在的房間、自己的書桌、椅、床邊、私人抽屜或工作位", "自己的家、辦公室、車輛或共用空間中屬於自己的一邊", "就在附近、伸手可及或通常最先查看的地方"] },
  2: { setting_en: "money, movable possessions, valuables, income, resources, personal financial support", setting_zh: "金錢、可移動財物、貴重物、收入、資源、個人財務支持",
    context_en: "resource, valuables and money-holding places", context_zh: "存放資源、貴重物與金錢的地方",
    related_en: ["bank, cash counter, finance office or safe-deposit", "wallet, purse, cash box, safe, valuables cabinet or jewellery storage", "personal storage, wardrobe, cupboard, shelf or stock area", "a workplace area handling revenue, accounts, cash or valuables"],
    related_zh: ["銀行、收銀處、財務室或保管箱", "銀包、錢包、錢箱、保險箱、貴重物櫃或首飾收納", "個人收納、衣櫃、櫥櫃、架或存貨區", "處理收入、帳目、現金或貴重物的工作區"] },
  3: { setting_en: "communication, documents, messages, short travel, siblings, relatives, neighbours, local community", setting_zh: "溝通、文件、訊息、短途、兄弟姊妹、親戚、鄰居、本地社區",
    context_en: "House 3 distance is fixed 'far': render it as 'outside the immediate personal space, in the nearby movement/communication environment'", context_zh: "第三宮距離固定為「遠」：表述為「離開眼前的個人空間，在附近的走動或通訊環境」",
    related_en: ["a nearby street, corridor, lobby, lift area, local shop or neighbour's place", "a bus stop, station, vehicle, bicycle area or short-trip route", "desk, mailbox, post area, courier, printer or filing area", "a bag or container for commuting, errands or daily communication"],
    related_zh: ["附近的街道、走廊、大堂、電梯區、就近商店或鄰居的地方", "巴士站、車站、車輛、單車區或短途路線", "書桌、信箱、郵寄區、速遞、打印機或存檔區", "用於通勤、辦事或日常通訊的袋或容器"] },
  4: { setting_en: "home, parents, family, ancestors, property, land, private foundations, hidden domestic space", setting_zh: "家、父母、家人、祖先、物業、土地、私密根基、隱蔽的家居空間",
    context_en: "vs House 12, House 4 stays connected to home, family, land or the private household — usually a usable search context, not isolation", context_zh: "相對第十二宮，第四宮仍連繫家、家人、土地或私人家居——通常是可搜尋的情境，而非隔離",
    related_en: ["the questioner's, parents' or family home or property", "bedroom, living or family room, family storage or important-document storage", "basement, low cupboard, bottom shelf, under furniture or inside a fixed household cabinet", "near family records, property documents, photographs or household archives"],
    related_zh: ["問卜者、父母或家人的家或物業", "睡房、客廳或家庭房、家庭收納或重要文件收納", "地下室、矮櫃、底層、傢俬下方或固定家居櫃內", "近家庭記錄、物業文件、相片或家居檔案"] },
  5: { setting_en: "entertainment, games, pleasure, sport, creativity, children, social enjoyment", setting_zh: "娛樂、遊戲、愉悅、運動、創作、子女、社交享受",
    context_en: "recreation and creative places", context_zh: "消遣與創作的地方",
    related_en: ["playground, children's room or school activity room", "gym, sports field, game room, recreation or hobby area", "theatre, cinema, party or amusement venue", "art or craft room, music room, hobby desk or toy/game storage"],
    related_zh: ["遊樂場、兒童房或學校活動室", "健身室、運動場、遊戲室、康樂或興趣區", "劇院、戲院、派對或遊樂場地", "美術或手作室、音樂室、興趣書桌或玩具遊戲收納"] },
  6: { setting_en: "work, service, employees, routine duties, illness, clinics, animals and maintenance", setting_zh: "工作、服務、員工、日常職責、疾病、診所、動物與維修",
    context_en: "workplace, service and maintenance areas", context_zh: "工作、服務與維修的地方",
    related_en: ["office, workstation, staff room, service counter or routine-work area", "clinic, medical office, treatment room, pharmacy or health-service area", "pet area, animal clinic, stable or animal-supply storage", "cleaning cupboard, utility, maintenance room, laundry or staff storage"],
    related_zh: ["辦公室、工作位、員工室、服務櫃檯或例行工作區", "診所、醫務所、治療室、藥房或健康服務區", "寵物區、動物診所、馬廄或動物用品儲存", "清潔櫃、雜物、維修房、洗衣或員工儲存"] },
  7: { setting_en: "another person, partner, counterpart, opponent, adviser, doctor, astrologer, or destination", setting_zh: "另一人、伴侶、對方、對手、顧問、醫生、占星師，或目的地",
    context_en: "the other side or an agreed destination", context_zh: "對方的一邊或約定的目的地",
    related_en: ["intended destination, arrival point, delivery address or meeting point", "a partner's, client's, adviser's, doctor's or opponent's place", "meeting room, consultation room, reception or contract-signing place", "the other side of a shared space or an area controlled by another person"],
    related_zh: ["目的地、抵達點、送遞地址或會面點", "伴侶、客戶、顧問、醫生或對手的地方", "會議室、諮詢室、接待處或簽約地點", "共用空間中對方的一邊或由他人控制的區域"] },
  8: { setting_en: "danger, loss, decay, inheritance, partner's money, debt, tax, fear, confidential financial matters", setting_zh: "危險、損失、腐朽、遺產、伴侶的金錢、債務、稅務、恐懼、機密財務",
    context_en: "shared-resource and confidential-financial places; a fear place only if it also fits the physical evidence", context_zh: "共享資源與機密財務的地方；只有在也符合物理證據時才用恐懼場所",
    related_en: ["bank, loan office, tax office, insurance or financial records", "a place where another's money or shared assets are kept", "safe, locked financial cabinet or confidential account archive", "a damaged, decaying, waste, disposal or contaminated area"],
    related_zh: ["銀行、貸款處、稅局、保險或財務記錄", "存放他人金錢或共享資產的地方", "保險箱、上鎖財務櫃或機密帳戶檔案", "受損、腐朽、廢物、棄置或受污染的區域"] },
  9: { setting_en: "long travel, foreign places, religion, philosophy, higher education, law, publishing", setting_zh: "遠行、外地、宗教、哲學、高等教育、法律、出版",
    context_en: "far, foreign or higher-knowledge places", context_zh: "遠方、外地或高等知識的地方",
    related_en: ["university, lecture hall, academic library or language school", "publisher, printing house or large bookstore", "law office, court, legal-advice centre or document-certification office", "airport, port, travel office, embassy, consulate or immigration office"],
    related_zh: ["大學、演講廳、學術圖書館或語言學校", "出版社、印刷廠或大型書店", "律師樓、法院、法律諮詢中心或文件認證處", "機場、港口、旅遊機構、大使館、領事館或入境處"] },
  10: { setting_en: "career, status, reputation, authority, boss, management, mother, achievement", setting_zh: "事業、地位、名聲、權威、上司、管理、母親、成就",
    context_en: "workplace-of-standing and public-recognition places", context_zh: "有地位的工作場所與公眾認可的地方",
    related_en: ["workplace, company office, executive floor, manager's office or boardroom", "a public-facing place of reputation, achievement or official responsibility", "business-development, strategy or decision-making area", "the boss's, supervisor's or public authority's place"],
    related_zh: ["工作場所、公司辦公室、行政樓層、經理室或會議室", "與名聲、成就或正式責任相關的對外場所", "業務發展、策略或決策區", "上司、主管或公權力的地方"] },
  11: { setting_en: "friends, social circles, allies, helpers, organisations, associations, hopes and plans", setting_zh: "朋友、社交圈、盟友、幫手、組織、協會、願望與計劃",
    context_en: "group, community and helper places", context_zh: "群體、社群與幫手的地方",
    related_en: ["a friend's home, social gathering place, club, association or community group", "a team space, group meeting room, volunteer organisation or membership venue", "a café, event venue, shared hobby location or community centre", "a helper's, supporter's, colleague's or ally's space"],
    related_zh: ["朋友的家、聚會地點、會所、協會或社區團體", "團隊空間、小組會議室、義工組織或會員場地", "咖啡店、活動場地、共同興趣地點或社區中心", "幫手、支持者、同事或盟友的空間"] },
  12: { setting_en: "secrecy, concealment, confinement, isolation, hospitals, monasteries, difficulty recovering what is lost", setting_zh: "隱秘、隱藏、囚禁、隔離、醫院、修道院、難以尋回遺失之物",
    context_en: "vs House 4, House 12 more strongly indicates deeply concealed, inaccessible, overlooked or institutional-isolated — but never 'will never be found'", context_zh: "相對第四宮，第十二宮更強指深藏、難以到達、被忽略或機構隔離——但絕不「永不會找到」",
    related_en: ["hospital, care institution, retreat, monastery or isolated room", "a locked room, inaccessible storage, concealed compartment or back room not normally entered", "behind furniture, inside another container, beneath stored items or in a sealed bag/box", "a lost-property office, institutional storage or place controlled by others and hard to access"],
    related_zh: ["醫院、護理機構、靜修院、修道院或隔離房間", "上鎖房間、難以進入的收納、隱藏間格或不常進入的後房", "傢俬後方、另一容器內、堆放物品之下或封好的袋／盒中", "失物認領處、機構儲存或由他人控制而難以到達的地方"] },
});
