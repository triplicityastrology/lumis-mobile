import type { DieKind } from "./constants";

/**
 * Classical horary attributes for the dice reading — Level 2 course material
 * (行星強弱同埋行星等級表 & 星座原素; 宮位的吉凶、速度、遠近; Level 2 deck slides 3–9).
 *
 * Core doctrine encoded here:
 * - Planet = the core message and the person's/matter's internal capability.
 * - Sign  = the planet's CONDITION (dignity → virtues or vices) + the matter's
 *           element (nature / direction / place — never personality in horary).
 * - House = the EXTERNAL environment — its 吉凶 is separate from the planet's and
 *           often temporary; a strong planet can resist a bad house.
 */

/* ---------- planet 吉凶, speed, traits ---------- */

export type PlanetClassification =
  | "major_benefic"   // 大吉星
  | "minor_benefic"   // 小吉星
  | "major_malefic"   // 大凶星
  | "minor_malefic"   // 小凶星
  | "neutral"         // 中性（太陽/月亮/水星）
  | "outer"           // 三王星：無古典吉凶，比重較低，長期趨勢
  | "benefic_node"    // 龍頭
  | "malefic_node";   // 龍尾

export type SpeedBand = "fastest" | "fast" | "medium" | "slow" | "slowest";

export type PlanetAttributes = {
  classification: PlanetClassification;
  classificationZh: string;
  speed: SpeedBand;
  speedZh: string;
  /** Virtues shown when the planet is strong (ruler/exaltation). */
  goodTraits: string;
  /** Vices that surface when the planet is weak (fall/detriment). */
  badTraits: string;
  /** 書面語 reference: 好處／壞處. */
  traitsZhRef: string;
};

export const PLANET_ATTRIBUTES: Record<string, PlanetAttributes> = {
  sun: {
    classification: "neutral", classificationZh: "中性", speed: "medium", speedZh: "中",
    goodTraits: "Candid, loyal, confident, generous, sincere; a leader with self-command, respected",
    badTraits: "Arrogant, conceited, dismissive, wasteful, all show, selfish, attention-seeking",
    traitsZhRef: "坦白、忠誠、自信、慷慨、真誠、領袖、自制力強、受尊重／傲慢、自負、目中無人、浪費、虛有其表、自私、需要別人注意"
  },
  moon: {
    classification: "neutral", classificationZh: "中性", speed: "fastest", speedZh: "極快",
    goodTraits: "Peace-loving, gentle, fluid, sensitive to people and surroundings; a good messenger",
    badTraits: "Moody, passive, easily swayed, drifting with the current",
    traitsZhRef: "愛和平、溫柔、具流動性、對身邊的人和環境敏感、良好的傳訊者／情緒化、有惰性、柔弱、隨波逐流、容易被影響"
  },
  mercury: {
    classification: "neutral", classificationZh: "中性", speed: "fast", speedZh: "快",
    goodTraits: "Clever, curious, creative, logical, articulate, light and quick",
    badTraits: "Gossipy, spreads misinformation, erratic, two-faced, unstable, restless",
    traitsZhRef: "聰明、好奇心強、富創意、邏輯強、善於溝通、輕巧快速／愛說是非、散播假消息、失控、雙面、不穩定、不安"
  },
  venus: {
    classification: "minor_benefic", classificationZh: "小吉星", speed: "fast", speedZh: "快",
    goodTraits: "Charming, at ease, sociable, giving, attractive, joyful",
    badTraits: "Indulgent at the cost of duty, lazy, prone to bad habits, jealous",
    traitsZhRef: "有魅力、寫意、社交能力強、樂於付出、有吸引力、開朗歡樂／沉溺享樂而忽略責任、懶惰、不良嗜好、嫉妒"
  },
  mars: {
    classification: "minor_malefic", classificationZh: "小凶星", speed: "medium", speedZh: "中",
    goodTraits: "Brave, driven, enterprising, direct, proactive, action-oriented",
    badTraits: "Violent, impulsive, troublesome, treacherous; accidents, injuries, conflict",
    traitsZhRef: "勇敢、有衝勁、進取、直接、主動、有行動力／暴力、衝動、麻煩、背信棄義、意外、受傷、爭執"
  },
  jupiter: {
    classification: "major_benefic", classificationZh: "大吉星", speed: "slow", speedZh: "慢",
    goodTraits: "Generous, trustworthy, honest, free, principled, wise, capable, resourceful",
    badTraits: "Wasteful, reckless, indulgent, exaggerating, greedy, careless",
    traitsZhRef: "大方、守信、慷慨、誠實、自由、品德高尚、有智慧、有能力、有資源／浪費、魯莽、放縱、誇張、貪婪、粗心大意"
  },
  saturn: {
    classification: "major_malefic", classificationZh: "大凶星", speed: "slow", speedZh: "慢",
    goodTraits: "Patient, persistent, serious, committed, diligent, mature, responsible, authoritative",
    badTraits: "Fearful, hostile, insincere, miserly, critical, aloof, harsh, pressured, gloomy",
    traitsZhRef: "有耐性、持續、認真、承諾、勤奮、成熟、有責任感、權威／恐懼、敵意、不真誠、吝嗇、批評他人、疏離、嚴厲、壓力大、憂鬱"
  },
  uranus: {
    classification: "outer", classificationZh: "三王星（無古典吉凶，比重較低）", speed: "slowest", speedZh: "極慢",
    goodTraits: "Stimulation, breakthrough; outside the mainstream",
    badTraits: "Stimulation, separation; outside the mainstream",
    traitsZhRef: "刺激、突破、非主流、非常態／刺激、分離、非主流、非常態"
  },
  neptune: {
    classification: "outer", classificationZh: "三王星（無古典吉凶，比重較低）", speed: "slowest", speedZh: "極慢",
    goodTraits: "Dreams, spirituality; outside the mainstream",
    badTraits: "Deception, confusion; outside the mainstream",
    traitsZhRef: "夢想、靈性、非主流、非常態／欺騙、迷惘、非主流、非常態"
  },
  pluto: {
    classification: "outer", classificationZh: "三王星（無古典吉凶，比重較低）", speed: "slowest", speedZh: "極慢",
    goodTraits: "Deep transformation, rebirth; outside the mainstream",
    badTraits: "Obsession, control; outside the mainstream",
    traitsZhRef: "深層轉化、重生、非主流、非常態／沉溺、控制、非主流、非常態"
  },
  north_node: {
    classification: "benefic_node", classificationZh: "吉", speed: "slow", speedZh: "慢",
    goodTraits: "Opportunity, growth, the direction ahead — room to advance",
    badTraits: "The unease that comes with a new direction",
    traitsZhRef: "機會、成長、未來方向、有進步空間／新方向帶來的不安"
  },
  south_node: {
    classification: "malefic_node", classificationZh: "凶／大凶", speed: "slow", speedZh: "慢",
    goodTraits: "Accumulated gifts and experience",
    badTraits: "Old habits, attachment, stagnation — something to let go",
    traitsZhRef: "累積的天賦與經驗／過去的慣性、執著、停滯不前、需要放手"
  }
};

/* ---------- dignities (行星強弱四大等級) ---------- */

export type Dignity = "ruler" | "exaltation" | "peregrine" | "fall" | "detriment";

type DignityTable = { ruler: string[]; exaltation: string[]; fall: string[]; detriment: string[] };

const EMPTY: DignityTable = { ruler: [], exaltation: [], fall: [], detriment: [] };

export const DIGNITY_TABLE: Record<string, DignityTable> = {
  sun: { ruler: ["leo"], exaltation: ["aries"], fall: ["libra"], detriment: ["aquarius"] },
  moon: { ruler: ["cancer"], exaltation: ["taurus"], fall: ["scorpio"], detriment: ["capricorn"] },
  mercury: { ruler: ["gemini", "virgo"], exaltation: ["virgo"], fall: ["pisces"], detriment: ["sagittarius", "pisces"] },
  venus: { ruler: ["taurus", "libra"], exaltation: ["pisces"], fall: ["virgo"], detriment: ["aries", "scorpio"] },
  mars: { ruler: ["aries", "scorpio"], exaltation: ["capricorn"], fall: ["cancer"], detriment: ["taurus", "libra"] },
  jupiter: { ruler: ["sagittarius", "pisces"], exaltation: ["cancer"], fall: ["capricorn"], detriment: ["gemini", "virgo"] },
  saturn: { ruler: ["capricorn", "aquarius"], exaltation: ["libra"], fall: ["aries"], detriment: ["cancer", "leo"] },
  uranus: { ...EMPTY, ruler: ["aquarius"] },
  neptune: { ...EMPTY, ruler: ["pisces"] },
  pluto: { ...EMPTY, ruler: ["scorpio"] },
  north_node: EMPTY,
  south_node: EMPTY
};

export type DignityReading = {
  dignity: Dignity;
  dignityZh: string;
  /**
   * Mercury special case: Virgo = ruler AND exaltation (doubly strongest);
   * Pisces = fall AND detriment (doubly weakest).
   */
  doubled: boolean;
  /** strong → planet shows its 好處 and can resist a bad house; weak → 壞處 surfaces. */
  strength: "strong" | "neutral" | "weak";
};

const DIGNITY_ZH: Record<Dignity, string> = {
  ruler: "守護（最強）",
  exaltation: "得利（頗強）",
  peregrine: "一般（無特別強弱）",
  fall: "失利（頗弱）",
  detriment: "弱勢（最弱）"
};

export function dignityOf(planetKey: string, signKey: string): DignityReading {
  const table = DIGNITY_TABLE[planetKey] ?? EMPTY;
  const isRuler = table.ruler.includes(signKey);
  const isExalt = table.exaltation.includes(signKey);
  const isFall = table.fall.includes(signKey);
  const isDetriment = table.detriment.includes(signKey);
  if (isRuler || isExalt) {
    const dignity: Dignity = isRuler ? "ruler" : "exaltation";
    return { dignity, dignityZh: DIGNITY_ZH[dignity], doubled: isRuler && isExalt, strength: "strong" };
  }
  if (isFall || isDetriment) {
    const dignity: Dignity = isDetriment ? "detriment" : "fall";
    return { dignity, dignityZh: DIGNITY_ZH[dignity], doubled: isFall && isDetriment, strength: "weak" };
  }
  return { dignity: "peregrine", dignityZh: DIGNITY_ZH.peregrine, doubled: false, strength: "neutral" };
}

/* ---------- sign elements (星座原素：形容事物，唔係性格) ---------- */

export type Element = "fire" | "earth" | "air" | "water";

export const SIGN_ELEMENT: Record<string, Element> = {
  aries: "fire", leo: "fire", sagittarius: "fire",
  taurus: "earth", virgo: "earth", capricorn: "earth",
  gemini: "air", libra: "air", aquarius: "air",
  cancer: "water", scorpio: "water", pisces: "water"
};

export type ElementInfo = {
  element: "Fire" | "Earth" | "Air" | "Water";
  zh: string;
  /** The matter's nature/tempo. */
  nature: string;
  /** Compass direction (for locations / lost items). */
  direction: string;
  /** Typical places (for locations / lost items). */
  places: string;
  /** 書面語 reference: 性質／方位／地點. */
  zhRef: string;
};

export const ELEMENT_INFO: Record<Element, ElementInfo> = {
  fire: {
    element: "Fire", zh: "火",
    nature: "Intuition and action — proactive, fast, ignites at a spark",
    direction: "East",
    places: "Hot, bright, active places: stoves, kitchens, appliances, strong lighting, outer walls, lively crowded venues",
    zhRef: "直覺、行動——主動、快速、有推動力／東方／靠近熱源或火的地方、廚房、電器、燈光強處、屋外圍牆、熱鬧多人的場所"
  },
  earth: {
    element: "Earth", zh: "土",
    nature: "Groundedness and stability — slow but reliable, results-focused",
    direction: "South",
    places: "Ground level, low or underground, fixed spots: floors, under beds, bottom drawers, basements, gardens, car parks",
    zhRef: "踏實、穩定——慢而可靠，重實際結果／南方／地面、低處或地下、固定位置：地板、床下、櫃桶底、地下室、花園、停車場"
  },
  air: {
    element: "Air", zh: "風",
    nature: "Reason and communication — flexible, advances through words and messages",
    direction: "West",
    places: "High, open, airy places: window sides, desks, top shelves, upper floors, attics, rooftops, elevated spots",
    zhRef: "理智、溝通——靈活多變，靠對話與訊息推進／西方／高處、開揚、通風：窗邊、書桌、櫃頂、上層、閣樓、天台、離地位置"
  },
  water: {
    element: "Water", zh: "水",
    nature: "Feeling and flow — soft, sensitive; things may hide deep",
    direction: "North",
    places: "Wet, dark, water-adjacent places: bathrooms, kitchen sinks, laundry, fish tanks, pools, riversides, damp corners",
    zhRef: "情感、流動——柔軟敏感，可能藏得深／北方／潮濕、陰暗、近水：浴室、水槽、洗衣間、魚缸、水池、河邊、潮濕角落"
  }
};

/* ---------- house 吉凶 / speed / distance ---------- */

export type HouseClassification = "great_fortune" | "fortune" | "misfortune" | "great_misfortune";
export type Distance = "near" | "middle" | "far";

export type HouseAttributes = {
  /** 吉凶排序 1 (最吉) … 12 (最凶). */
  rank: number;
  classification: HouseClassification;
  classificationZh: string;
  speed: "fast" | "medium" | "slow";
  speedZh: string;
  distance: Distance;
  distanceZh: string;
  /** One-line reading note from the course. */
  note: string;
  /** 書面語 reference for the note. */
  noteZh: string;
};

export const HOUSE_ATTRIBUTES: Record<string, HouseAttributes> = {
  house_1: { rank: 1, classification: "great_fortune", classificationZh: "大吉", speed: "fast", speedZh: "快", distance: "near", distanceZh: "近", note: "Begins with yourself — you hold the initiative; the matter can be carried by your own action", noteZh: "由自己出發，有主導權，事情可靠自己成事" },
  house_2: { rank: 9, classification: "misfortune", classificationZh: "凶", speed: "medium", speedZh: "中", distance: "middle", distanceZh: "中", note: "Easily stuck on money, possessions, or an overactive need for security", noteZh: "容易卡在金錢、物質或過強的安全感／佔有慾" },
  house_3: { rank: 8, classification: "fortune", classificationZh: "吉", speed: "slow", speedZh: "慢", distance: "far", distanceZh: "遠", note: "Smaller influence; details resolve through communication", noteZh: "影響力較小，細節可透過溝通解決" },
  house_4: { rank: 4, classification: "great_fortune", classificationZh: "大吉", speed: "fast", speedZh: "快", distance: "near", distanceZh: "近", note: "The matter lands — it can settle onto solid foundations", noteZh: "事情落地、有根基、可以安定" },
  house_5: { rank: 6, classification: "fortune", classificationZh: "吉", speed: "medium", speedZh: "中", distance: "middle", distanceZh: "中", note: "Brings joy and inspiration; especially good for love and creative questions", noteZh: "帶來快樂與靈感；問愛情、創作特別有利" },
  house_6: { rank: 11, classification: "great_misfortune", classificationZh: "大凶", speed: "slow", speedZh: "慢", distance: "far", distanceZh: "遠", note: "Pressure, toil, strain — yet also the emblem of effort and growth through difficulty", noteZh: "壓力、勞損、辛苦；但亦是努力與成長的象徵" },
  house_7: { rank: 3, classification: "great_fortune", classificationZh: "大吉", speed: "fast", speedZh: "快", distance: "near", distanceZh: "近", note: "Good for anything involving others — interaction and collaboration; going solo hints you will need people", noteZh: "與人相關的事屬吉——有互動、有協作；單獨行事則提示需要靠人" },
  house_8: { rank: 10, classification: "misfortune", classificationZh: "凶", speed: "medium", speedZh: "中", distance: "middle", distanceZh: "中", note: "Pressure and risk; handle resources, finances, or power questions with care", noteZh: "有壓力有風險，須妥善處理資源、財務或權力問題" },
  house_9: { rank: 7, classification: "fortune", classificationZh: "吉", speed: "slow", speedZh: "慢", distance: "far", distanceZh: "遠", note: "Room to grow toward something higher, but it needs time to mature", noteZh: "有成長空間，向更高層次發展，但需要時間醞釀" },
  house_10: { rank: 2, classification: "great_fortune", classificationZh: "大吉", speed: "fast", speedZh: "快", distance: "near", distanceZh: "近", note: "Comes into the light — clear outcomes, recognition, easy to succeed", noteZh: "得見光明——結果明朗、被認可、容易成事" },
  house_11: { rank: 5, classification: "fortune", classificationZh: "吉", speed: "medium", speedZh: "中", distance: "middle", distanceZh: "中", note: "Helpers, benefactors, and support are available", noteZh: "有幫手、有貴人、有支持" },
  house_12: { rank: 12, classification: "great_misfortune", classificationZh: "大凶", speed: "slow", speedZh: "慢", distance: "far", distanceZh: "遠", note: "Progress unclear, hidden obstacles; yet fitting for hospitals, charity, healing, and spiritual matters", noteZh: "進展不明朗、有隱藏阻力；但問醫院、慈善、療癒、靈性反而是合適的象徵" }
};

/* ---------- derived tensions & timing ---------- */

export type ReadingTension =
  | "strong_planet_bad_house"   // 內在有能力，外在環境差（環境係暫時嘅）
  | "weak_planet_good_house"    // 環境有利，但自身狀態未就緒
  | "aligned_favorable"
  | "aligned_challenging"
  | "mixed";

const FAVORABLE_HOUSE = new Set<HouseClassification>(["great_fortune", "fortune"]);

export function readTension(
  planetKey: string,
  signKey: string,
  houseKey: string
): ReadingTension {
  const dignity = dignityOf(planetKey, signKey);
  const planet = PLANET_ATTRIBUTES[planetKey];
  const house = HOUSE_ATTRIBUTES[houseKey];
  const beneficPlanet =
    planet.classification === "major_benefic" ||
    planet.classification === "minor_benefic" ||
    planet.classification === "benefic_node";
  const maleficPlanet =
    planet.classification === "major_malefic" ||
    planet.classification === "minor_malefic" ||
    planet.classification === "malefic_node";
  // Planet-side favourability = 吉凶屬性 modulated by dignity (a strong planet
  // shows 好處 and can resist; a weak one leaks 壞處).
  const planetFavorable = dignity.strength === "strong" || (beneficPlanet && dignity.strength !== "weak");
  const planetChallenged = dignity.strength === "weak" || (maleficPlanet && dignity.strength !== "strong");
  const houseFavorable = FAVORABLE_HOUSE.has(house.classification);
  if (planetFavorable && !houseFavorable) return "strong_planet_bad_house";
  if (planetChallenged && houseFavorable) return "weak_planet_good_house";
  if (planetFavorable && houseFavorable) return "aligned_favorable";
  if (planetChallenged && !houseFavorable) return "aligned_challenging";
  return "mixed";
}

const SPEED_ORDER: Record<SpeedBand, number> = { fastest: 0, fast: 1, medium: 2, slow: 3, slowest: 4 };

/**
 * Combined pace of planet speed × house speed. Units are RELATIVE to the
 * question (course 8.5): lost items — hours/days; career/migration — months+.
 */
export function combinedPace(planetKey: string, houseKey: string): "fast" | "medium" | "slow" {
  const planetSpeed = SPEED_ORDER[PLANET_ATTRIBUTES[planetKey].speed];
  const houseSpeed = { fast: 1, medium: 2, slow: 3 }[HOUSE_ATTRIBUTES[houseKey].speed];
  const combined = (planetSpeed + houseSpeed) / 2;
  if (combined <= 1.2) return "fast";
  if (combined <= 2.2) return "medium";
  return "slow";
}

export function attributesForDie(kind: DieKind): "planet" | "sign" | "house" {
  return kind;
}
