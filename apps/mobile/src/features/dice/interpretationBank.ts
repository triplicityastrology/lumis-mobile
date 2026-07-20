import { DICE_TIMINGS, type DiceFace, type DiceSymbols } from "./constants";
import {
  combinedPace, dignityOf, readTension,
  ELEMENT_INFO, HOUSE_ATTRIBUTES, PLANET_ATTRIBUTES, SIGN_ELEMENT,
  type DignityReading, type ElementInfo, type HouseAttributes, type PlanetAttributes,
  type ReadingTension
} from "./classicalAttributes";

/**
 * Interpretation bank (Level 1 meanings) + Level 2 classical layer — see
 * AC-DICE-05 for the full logic and route prompt, AC-DICE-06 for the
 * human-readable review copy.
 *
 * Language policy (founder, 2026-07-20): all logic/data strings are ENGLISH.
 * `zhRef` is Traditional Chinese in standard written form (書面語) for reference
 * only — never Cantonese colloquialisms. The AI replies in the user's language.
 */

export type BankEntry = {
  /** Core meaning. */
  essence: string;
  /** Supporting detail: expression style / typical scope. */
  detail: string;
  /** Shadow side — source for the single watch-out line. */
  watchOut: string;
  /** 書面語 reference: essence／detail／watch-out. */
  zhRef: string;
};

export const PLANET_BANK: Record<string, BankEntry> = {
  sun: {
    essence: "Self, will, and vitality",
    detail: "Core purpose, leadership, visibility, the father figure",
    watchOut: "Centering everything on yourself and missing other voices",
    zhRef: "自我、意志與生命力／核心目標、領導力、父親形象／過於自我，聽不進其他聲音"
  },
  moon: {
    essence: "Emotions, intuition, and the need for safety",
    detail: "Inner needs, home, memory, the mother figure; changeable",
    watchOut: "Feelings leading the way; being easily swayed by others",
    zhRef: "情感、直覺與安全感／內心需要、家、記憶、母親形象／情緒先行，容易受人影響"
  },
  mercury: {
    essence: "Communication, thinking, and information",
    detail: "Language, logic, learning, documents, short trips, transactions",
    watchOut: "Overthinking or noisy information clouding the picture",
    zhRef: "溝通、思考與資訊／語言、邏輯、學習、文件、短途、交易／思慮過多或訊息混亂，反而看不清"
  },
  venus: {
    essence: "Love, beauty, and value",
    detail: "Harmony, attraction, relationships, the flow of money",
    watchOut: "Over-accommodating for comfort or approval",
    zhRef: "愛、美感與價值／和諧、吸引力、關係、金錢流動／為了舒適或討好而過度遷就"
  },
  mars: {
    essence: "Drive, courage, and momentum",
    detail: "Competition, decisiveness, physical energy, direct action",
    watchOut: "Heat and haste that spark unnecessary conflict",
    zhRef: "行動力、勇氣與衝勁／競爭、決斷、體力、直接行動／火氣與急躁，容易擦槍走火"
  },
  jupiter: {
    essence: "Expansion, opportunity, and confidence",
    detail: "Growth, vision, benefactors, accumulating resources",
    watchOut: "Over-optimism — promises or spending running past reality",
    zhRef: "擴展、機遇與信心／成長、遠見、貴人、資源累積／過分樂觀，承諾或開支容易超出"
  },
  saturn: {
    essence: "Responsibility, structure, and patience",
    detail: "Time, discipline, maturity, career foundations",
    watchOut: "Pressure and pessimism slowing you more than needed",
    zhRef: "責任、結構與耐性／時間、紀律、成熟、事業根基／壓力與悲觀，使步伐比需要的更慢"
  },
  uranus: {
    essence: "Change, breakthrough, and freedom",
    detail: "Innovation, surprises, the unconventional path",
    watchOut: "Sudden shifts, or change purely for its own sake",
    zhRef: "轉變、突破與自由／革新、意外、非傳統之路／突然的變動，或為變而變"
  },
  neptune: {
    essence: "Dreams, intuition, and imagination",
    detail: "Inspiration, art, empathy, unconditional giving",
    watchOut: "Blurred boundaries; idealizing what is real",
    zhRef: "夢想、直覺與想像／靈感、藝術、同理、無條件付出／界線模糊，把現實理想化"
  },
  pluto: {
    essence: "Transformation, depth, and rebirth",
    detail: "Power, focus, the subconscious, complete renewal",
    watchOut: "Obsession and control — release comes before renewal",
    zhRef: "轉化、深層改變與重生／權力、專注、潛意識、徹底更新／執著與控制，放手才有新開始"
  },
  north_node: {
    essence: "Growth direction and life lessons",
    detail: "The new path the soul is meant to develop",
    watchOut: "A new direction feels unfamiliar — that doesn't make it wrong",
    zhRef: "成長方向與人生課題／靈魂應發展的新路／新方向會不習慣，不等於不對"
  },
  south_node: {
    essence: "Past experience and habitual patterns",
    detail: "Accumulated gifts, and dependencies to release",
    watchOut: "Clinging to the comfort zone; old methods on new problems",
    zhRef: "過去經驗與慣性模式／累積的天賦，以及需要放下的依賴／留戀舒適圈，用舊方法應付新問題"
  }
};

export const SIGN_BANK: Record<string, BankEntry> = {
  aries: {
    essence: "Direct — action first",
    detail: "Initiating, fast, competitive",
    watchOut: "Moving before thinking it through",
    zhRef: "直接、行動先行／開創、快速、有競爭心／太急，未想清楚就出手"
  },
  taurus: {
    essence: "Steady — one step at a time",
    detail: "Practical, savoring, slow and thorough",
    watchOut: "Stubbornness that misses the moment to change",
    zhRef: "穩健、循序漸進／重實際、重享受、慢工出細活／固執，錯過改變的時機"
  },
  gemini: {
    essence: "Conversation, information, and flexibility",
    detail: "Curious, adaptable, many channels of communication",
    watchOut: "Scattered focus — more talk than follow-through",
    zhRef: "交流、資訊與彈性／好奇、靈活、多渠道溝通／三心兩意，說多做少"
  },
  cancer: {
    essence: "Care and emotional connection",
    detail: "Safety, home, nostalgia",
    watchOut: "Leading with feelings while keeping them unspoken",
    zhRef: "照顧、情感連結／安全感、家、念舊／情緒化，收在心裡不說"
  },
  leo: {
    essence: "Confidence — showing up generously",
    detail: "Stage presence, creativity, warmth",
    watchOut: "Pride making feedback hard to hear",
    zhRef: "自信、大方展現／舞台感、創造力、慷慨／愛面子，聽不進意見"
  },
  virgo: {
    essence: "Care with detail — practical analysis",
    detail: "Planning, refinement, attention to detail",
    watchOut: "Perfectionism slowing the whole matter down",
    zhRef: "細心、實際分析／規劃、改善、注重細節／挑剔，完美主義拖慢進度"
  },
  libra: {
    essence: "Balance and coordinating relationships",
    detail: "Cooperation, negotiation, aesthetics",
    watchOut: "Deliberating without deciding; self-sacrifice for harmony",
    zhRef: "平衡、協調關係／合作、談判、美感／議而不決，為和諧委屈自己"
  },
  scorpio: {
    essence: "Depth — facing things completely",
    detail: "Focus, insight, unafraid of the shadow",
    watchOut: "Suspicion and extremes; tunneling into one point",
    zhRef: "深入、徹底面對／專注、洞察、不怕黑暗面／猜疑與極端，容易鑽牛角尖"
  },
  sagittarius: {
    essence: "Looking further — exploring meaning",
    detail: "Optimism, learning, distant horizons",
    watchOut: "Grand visions outpacing details and commitments",
    zhRef: "放遠目光、探索意義／樂觀、學習、遠方／目標宏大，細節與承諾跟不上"
  },
  capricorn: {
    essence: "Planning — building for the long term",
    detail: "Diligence, discipline, a clear goal",
    watchOut: "Conservatism; all work and no feeling",
    zhRef: "有計劃、長線經營／實幹、紀律、目標感／太保守，只顧做事忽略感受"
  },
  aquarius: {
    essence: "Thinking outside the frame",
    detail: "Innovation, group vision, independence",
    watchOut: "Being too detached or abstract for others to follow",
    zhRef: "跳出框架思考／創新、群體視野、獨立／過於抽離，別人跟不上"
  },
  pisces: {
    essence: "Intuition and empathy",
    detail: "Imagination, acceptance, artistic feeling",
    watchOut: "Blurred boundaries; drifting from reality",
    zhRef: "直覺與同理心／想像力、包容、藝術感／界線模糊，逃避現實"
  }
};

export const HOUSE_BANK: Record<string, BankEntry> = {
  house_1: {
    essence: "You yourself — your state",
    detail: "Character, health, personal image",
    watchOut: "The heart of the matter may be in you",
    zhRef: "你自己、你的狀態／性格、健康、個人形象／問題核心可能在自己身上"
  },
  house_2: {
    essence: "Money and resources",
    detail: "Income, assets, how you earn, self-worth",
    watchOut: "Check the real numbers, not the feeling",
    zhRef: "金錢與資源／收入、資產、賺錢方式、自我價值／留意實際數字，不要靠感覺"
  },
  house_3: {
    essence: "Communication, news, and people nearby",
    detail: "Documents, learning, siblings, neighbors, short trips",
    watchOut: "The information may be incomplete — verify before acting",
    zhRef: "溝通、消息與身邊人／文件、學習、兄弟姊妹、鄰里、短途／消息未必齊全，查證後再行動"
  },
  house_4: {
    essence: "Home and foundations",
    detail: "Family, property, inner security",
    watchOut: "Home matters may be coloring your judgment",
    zhRef: "家與根基／家人、房產、內心安全感／家裡的事會影響你的判斷"
  },
  house_5: {
    essence: "Joy, creation, and romance",
    detail: "Recreation, interests, children, self-expression",
    watchOut: "Balance pleasure with what must be done",
    zhRef: "享受、創作與戀愛／娛樂、興趣、子女、表達自己／玩樂與正事之間需要平衡"
  },
  house_6: {
    essence: "Daily work and health",
    detail: "Duties, service, colleagues, the body",
    watchOut: "Don't let the daily grind wear you down",
    zhRef: "日常工作與健康／職務、服務、同事、身體狀態／別讓日常瑣事消磨了你"
  },
  house_7: {
    essence: "Partners and one-to-one relationships",
    detail: "Partnerships, collaborators, open rivals",
    watchOut: "This matter is not yours alone",
    zhRef: "伴侶與合作關係／一對一關係、拍檔、公開的對手／這件事不只關乎你一個人"
  },
  house_8: {
    essence: "Shared resources and deep transformation",
    detail: "Debts, taxes, fears, release and rebirth",
    watchOut: "Other people's resources are involved — make terms explicit",
    zhRef: "共享資源與深層轉化／債務、稅務、恐懼、放下與重生／涉及他人資源，條款要清楚"
  },
  house_9: {
    essence: "Faraway places, learning, and beliefs",
    detail: "Abroad, further study, law, worldview",
    watchOut: "Keep the big picture grounded",
    zhRef: "遠方、學習與信念／外國、進修、法律、人生觀／設想大方向之餘記得落地"
  },
  house_10: {
    essence: "Career and reputation",
    detail: "Status, achievement, superiors, public image",
    watchOut: "Mind how your choice is seen",
    zhRef: "事業與名聲／地位、成就、上司、公眾形象／留意別人如何看你的選擇"
  },
  house_11: {
    essence: "Friends and community",
    detail: "Networks, groups, hopes, fellow travelers",
    watchOut: "The group's opinion is not necessarily your path",
    zhRef: "朋友與群體／人脈、社群、願景、同路人／群體的意見未必等於你的路"
  },
  house_12: {
    essence: "The inner world and what's hard to release",
    detail: "Secrets, solitude, the subconscious, retreat",
    watchOut: "Something is tucked away — stillness reveals it",
    zhRef: "內心世界與難以放下的事／秘密、獨處、潛意識、退隱／有些事被收起，靜下來才看得見"
  }
};

export type DiceInterpretationRequest = {
  /** Fixed tool marker for the router (charge 5 credits at interpretation time). */
  aiTool: "dice";
  question: string;
  symbols: {
    planet: { face: DiceFace; meaning: BankEntry };
    sign: { face: DiceFace; meaning: BankEntry };
    house: { face: DiceFace; meaning: BankEntry };
  };
  /**
   * Level 2 classical layer (dignities, benefic/malefic classes, speeds,
   * elements, house fortune/speed/distance). Doctrine: planet = core message +
   * internal capability; house = EXTERNAL environment (temporary); their
   * fortune polarity can conflict and the reading must resolve that tension,
   * not average it away. Fortune machinery applies to judgment questions only —
   * descriptive questions read the base meanings as description (AC-DICE-05 §1–2).
   */
  classical: {
    planet: PlanetAttributes & { dignity: DignityReading };
    signElement: ElementInfo;
    house: HouseAttributes;
    tension: ReadingTension;
    /** Combined planet × house pace; units are relative to the question's nature. */
    pace: "fast" | "medium" | "slow";
  };
  /**
   * Required reading structure (AC-DICE-01 §6 + AC-DICE-05 §4): acknowledge →
   * woven reading (with tension/timing where relevant) → exactly ONE watch-out
   * → one practical direction → invitation to chat. Reflective register; an
   * angle, never a verdict. Repeated symbols acknowledged charmingly, never
   * re-drawn.
   */
  structureVersion: "dice_reading_v2";
};

export function buildDiceInterpretationRequest(
  question: string,
  symbols: DiceSymbols
): DiceInterpretationRequest {
  const planetKey = symbols.planet.key;
  const signKey = symbols.sign.key;
  const houseKey = symbols.house.key;
  return {
    aiTool: "dice",
    question: question.trim() || "What should I notice right now?",
    symbols: {
      planet: { face: symbols.planet, meaning: PLANET_BANK[planetKey] },
      sign: { face: symbols.sign, meaning: SIGN_BANK[signKey] },
      house: { face: symbols.house, meaning: HOUSE_BANK[houseKey] }
    },
    classical: {
      planet: { ...PLANET_ATTRIBUTES[planetKey], dignity: dignityOf(planetKey, signKey) },
      signElement: ELEMENT_INFO[SIGN_ELEMENT[signKey]],
      house: HOUSE_ATTRIBUTES[houseKey],
      tension: readTension(planetKey, signKey, houseKey),
      pace: combinedPace(planetKey, houseKey)
    },
    structureVersion: "dice_reading_v2"
  };
}

// Re-exported so the interpretation surface and the stage share one timing sheet.
export { DICE_TIMINGS };
