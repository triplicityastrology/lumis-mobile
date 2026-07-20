/**
 * Dice ritual constants — face sets and motion timings.
 *
 * Face sets confirmed by the founder from the Triplicity Level 1 course deck
 * (2026-07-19): planet die is the 10 planets + North/South Node (no Chiron);
 * house die uses Arabic numerals 1–12 (not Roman).
 *
 * Timings are the single tuning surface for the whole ritual (AC-DICE-04 §9);
 * adjust feel here, not inline in components.
 */

export type DieKind = "planet" | "sign" | "house";

export type DiceFace = {
  /** Stable key stored on dice_throws rows and used by the interpretation route. */
  key: string;
  glyph: string;
  zh: string;
  en: string;
};

export const PLANET_FACES: readonly DiceFace[] = [
  { key: "sun", glyph: "☉", zh: "太陽", en: "Sun" },
  { key: "moon", glyph: "☽", zh: "月亮", en: "Moon" },
  { key: "mercury", glyph: "☿", zh: "水星", en: "Mercury" },
  { key: "venus", glyph: "♀", zh: "金星", en: "Venus" },
  { key: "mars", glyph: "♂", zh: "火星", en: "Mars" },
  { key: "jupiter", glyph: "♃", zh: "木星", en: "Jupiter" },
  { key: "saturn", glyph: "♄", zh: "土星", en: "Saturn" },
  { key: "uranus", glyph: "♅", zh: "天王星", en: "Uranus" },
  { key: "neptune", glyph: "♆", zh: "海王星", en: "Neptune" },
  { key: "pluto", glyph: "♇", zh: "冥王星", en: "Pluto" },
  { key: "north_node", glyph: "☊", zh: "龍頭", en: "North Node" },
  { key: "south_node", glyph: "☋", zh: "龍尾", en: "South Node" }
];

export const SIGN_FACES: readonly DiceFace[] = [
  { key: "aries", glyph: "♈", zh: "白羊座", en: "Aries" },
  { key: "taurus", glyph: "♉", zh: "金牛座", en: "Taurus" },
  { key: "gemini", glyph: "♊", zh: "雙子座", en: "Gemini" },
  { key: "cancer", glyph: "♋", zh: "巨蟹座", en: "Cancer" },
  { key: "leo", glyph: "♌", zh: "獅子座", en: "Leo" },
  { key: "virgo", glyph: "♍", zh: "處女座", en: "Virgo" },
  { key: "libra", glyph: "♎", zh: "天秤座", en: "Libra" },
  { key: "scorpio", glyph: "♏", zh: "天蠍座", en: "Scorpio" },
  { key: "sagittarius", glyph: "♐", zh: "人馬座", en: "Sagittarius" },
  { key: "capricorn", glyph: "♑", zh: "摩羯座", en: "Capricorn" },
  { key: "aquarius", glyph: "♒", zh: "水瓶座", en: "Aquarius" },
  { key: "pisces", glyph: "♓", zh: "雙魚座", en: "Pisces" }
];

export const HOUSE_FACES: readonly DiceFace[] = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  const zhNumerals = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
  const ordinal = n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
  return {
    key: `house_${n}`,
    glyph: String(n),
    zh: `第${zhNumerals[i]}宮`,
    en: `${ordinal} House`
  };
});

export const FACE_SETS: Record<DieKind, readonly DiceFace[]> = {
  planet: PLANET_FACES,
  sign: SIGN_FACES,
  house: HOUSE_FACES
};

export const DIE_ORDER: readonly DieKind[] = ["planet", "sign", "house"];

export type DiceSymbols = { planet: DiceFace; sign: DiceFace; house: DiceFace };

/** Motion timing sheet (AC-DICE-04 §2), in milliseconds unless noted. */
export const DICE_TIMINGS = {
  stageFadeIn: 350,
  breathingCycle: 4000,
  palmClose: 150,
  hintDelay: 400,
  hintFade: 300,
  mixResponseBudget: 50,
  mixStopSettle: 400,
  releaseSwap: 80,
  handExit: 250,
  cameraEase: 900,
  glowRise: 700,
  heldBeat: 600,
  sceneDim: 300,
  cardSlide: 420,
  tapFallbackAfter: 6000,
  throwDebounce: 500,
  rethrowCrossfade: 450
} as const;
