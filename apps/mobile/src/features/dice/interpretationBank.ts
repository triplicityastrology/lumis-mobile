import { DICE_TIMINGS, type DiceFace, type DiceSymbols } from "./constants";

/**
 * Interpretation bank v0.1 — DRAFT, awaiting founder refinement.
 *
 * Meanings are distilled from the Triplicity Level 1 course deck
 * (古典占星 - 占星骰占卜班 level 1.pptx): planet = What (energy),
 * sign = How (expression), house = Where (life area). The AI never draws the
 * result — it interprets these confirmed symbols for the user's question.
 *
 * `watchOut` feeds the route's single 要留意嘅位 line (AC-DICE-01 §6: exactly one,
 * kindly framed).
 */

export type BankEntry = {
  /** Core meaning, Cantonese-forward per app copy. */
  essence: string;
  /** Supporting detail: expression style / typical scope. */
  detail: string;
  /** The shadow side — source material for the single watch-out line. */
  watchOut: string;
};

export const PLANET_BANK: Record<string, BankEntry> = {
  sun: { essence: "自我、意志同生命力", detail: "核心目標、領導力、發光發熱、父親形象", watchOut: "太以自己為中心，聽唔到其他聲音" },
  moon: { essence: "情感、直覺同安全感", detail: "內心需要、屋企、記憶、母親形象、變化較大", watchOut: "情緒行先，容易受身邊人影響" },
  mercury: { essence: "溝通、思考同資訊", detail: "語言、邏輯、學習、文件、短途同交易", watchOut: "諗太多或者消息太亂，反而睇唔清" },
  venus: { essence: "愛、美感同價值", detail: "和諧、吸引力、關係、金錢嘅進出", watchOut: "為咗舒服或者面俾，遷就得太多" },
  mars: { essence: "行動力、勇氣同衝勁", detail: "競爭、決斷、體力、直接去做", watchOut: "火氣同急躁，容易擦槍走火" },
  jupiter: { essence: "擴展、機遇同信心", detail: "成長、遠見、貴人、資源累積", watchOut: "過分樂觀，承諾或使費容易超出" },
  saturn: { essence: "責任、結構同耐性", detail: "時間、紀律、成熟、事業根基", watchOut: "壓力同悲觀，令你行得比需要慢" },
  uranus: { essence: "轉變、突破同自由", detail: "革新、意外、非傳統嘅路", watchOut: "突然嘅變動，或者為變而變" },
  neptune: { essence: "夢想、直覺同想像", detail: "靈感、藝術、同理、無條件付出", watchOut: "界線模糊，將現實理想化" },
  pluto: { essence: "轉化、深層改變同重生", detail: "權力、專注、潛意識、徹底翻新", watchOut: "執著同控制，放手先有新開始" },
  north_node: { essence: "成長方向同人生課題", detail: "靈魂要發展嘅新路、提升點", watchOut: "新方向會唔慣，唔等於唔啱" },
  south_node: { essence: "過去經驗同慣性模式", detail: "累積嘅天賦，同埋要放低嘅依賴", watchOut: "留戀舒適圈，用舊方法應付新問題" }
};

export const SIGN_BANK: Record<string, BankEntry> = {
  aries: { essence: "直接、行動先行", detail: "開創、快、有競爭心", watchOut: "太急，未諗清楚就出手" },
  taurus: { essence: "穩陣、一步一步嚟", detail: "重實際、重享受、慢工出細貨", watchOut: "固執，錯過改變嘅時機" },
  gemini: { essence: "傾偈、資訊同彈性", detail: "好奇、靈活、多渠道溝通", watchOut: "三心兩意，講多過做" },
  cancer: { essence: "照顧、情感連結", detail: "安全感、屋企、念舊", watchOut: "情緒化，收埋自己唔講" },
  leo: { essence: "自信、大方展現", detail: "舞台感、創造力、慷慨", watchOut: "太要面，聽唔入意見" },
  virgo: { essence: "細心、實際分析", detail: "規劃、改善、注重細節", watchOut: "挑剔，完美主義拖慢件事" },
  libra: { essence: "平衡、協調關係", detail: "合作、談判、美感", watchOut: "議而不決，為和諧委屈自己" },
  scorpio: { essence: "深入、徹底面對", detail: "專注、洞察、唔怕黑暗面", watchOut: "猜疑同極端，容易鑽牛角尖" },
  sagittarius: { essence: "望遠啲、探索意義", detail: "樂觀、學習、遠方", watchOut: "大想頭，細節同承諾跟唔上" },
  capricorn: { essence: "有計劃、長線經營", detail: "實幹、紀律、目標感", watchOut: "太保守，只顧做嘢唔顧感受" },
  aquarius: { essence: "跳出框框諗", detail: "創新、群體視野、獨立", watchOut: "離地或者太疏離，人哋跟唔上" },
  pisces: { essence: "用直覺同同理心", detail: "想像力、包容、藝術感", watchOut: "界線模糊，逃避現實" }
};

export const HOUSE_BANK: Record<string, BankEntry> = {
  house_1: { essence: "你自己、你嘅狀態", detail: "性格、健康、個人形象", watchOut: "問題核心可能喺自己身上" },
  house_2: { essence: "金錢同資源", detail: "收入、資產、賺錢方法、自我價值", watchOut: "留意實際數字，唔好靠感覺" },
  house_3: { essence: "溝通、消息同身邊人", detail: "文件、學習、兄弟姊妹、鄰里、短途", watchOut: "消息未必齊全，查證先好行動" },
  house_4: { essence: "屋企同根基", detail: "家人、房產、內心安全感", watchOut: "屋企嘅事會影響你判斷" },
  house_5: { essence: "享受、創作同戀愛", detail: "娛樂、興趣、子女、表達自己", watchOut: "玩樂同正事之間要搵平衡" },
  house_6: { essence: "日常工作同健康", detail: "職務、服務、同事、身體狀態", watchOut: "咪畀日常瑣事磨蝕咗你" },
  house_7: { essence: "伴侶同合作關係", detail: "一對一關係、拍檔、公開嘅對手", watchOut: "件事唔只關你一個人事" },
  house_8: { essence: "共享資源同深層轉化", detail: "債務、稅務、恐懼、放低同重生", watchOut: "涉及人哋嘅資源，條款要清楚" },
  house_9: { essence: "遠方、學習同信念", detail: "外國、進修、法律、人生觀", watchOut: "諗大方向之餘記住落地" },
  house_10: { essence: "事業同名聲", detail: "地位、成就、上司、公眾形象", watchOut: "留意人哋點樣睇你嘅選擇" },
  house_11: { essence: "朋友同群體", detail: "人脈、社群、願景、同路人", watchOut: "群體嘅意見未必等於你嘅路" },
  house_12: { essence: "內心世界同放唔低嘅嘢", detail: "秘密、獨處、潛意識、退隱", watchOut: "有啲嘢收埋咗，靜落嚟先見到" }
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
   * Required reading structure (AC-DICE-01 §6) for the route.dice prompt:
   * 1. one line acknowledging the throw;
   * 2. the three symbols woven together for the question — planet as the What,
   *    sign as the How, house as the Where;
   * 3. 要留意嘅位 — exactly ONE concrete watch-out, kindly framed (draw from the
   *    watchOut fields, pick the most relevant, never list several);
   * 4. one sentence inviting the user to keep exploring in chat.
   * Register: reflective, warm, an angle never a verdict. If the same symbols
   * repeat across throws, acknowledge it charmingly rather than re-drawing.
   */
  structureVersion: "dice_reading_v1";
};

export function buildDiceInterpretationRequest(
  question: string,
  symbols: DiceSymbols
): DiceInterpretationRequest {
  return {
    aiTool: "dice",
    question: question.trim() || "而家有咩需要我留意？",
    symbols: {
      planet: { face: symbols.planet, meaning: PLANET_BANK[symbols.planet.key] },
      sign: { face: symbols.sign, meaning: SIGN_BANK[symbols.sign.key] },
      house: { face: symbols.house, meaning: HOUSE_BANK[symbols.house.key] }
    },
    structureVersion: "dice_reading_v1"
  };
}

// Re-exported so the interpretation surface and the stage share one timing sheet.
export { DICE_TIMINGS };
