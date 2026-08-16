import { buildDiceInterpretationRequest } from "../../../apps/mobile/src/features/dice/interpretationBank.ts";
import { HOUSE_FACES, PLANET_FACES, SIGN_FACES, type DiceFace } from "../../../apps/mobile/src/features/dice/constants.ts";
import type { DiceV03FixtureInput, DiceV03ModelResult } from "./dice-v0-3-interpretation-contract.ts";

export type DiceV03Presentation = Readonly<{
  opening: string;
  sections: readonly Readonly<{ heading: string; body: string }>[];
}>;

function face(faces: readonly DiceFace[], key: string): DiceFace {
  const value = faces.find((entry) => entry.key === key);
  if (!value) throw new Error("DICE_V03_PRESENTATION_LANDING_INVALID");
  return value;
}

export function presentDiceV03Result(
  result: DiceV03ModelResult,
  fixture: Pick<DiceV03FixtureInput, "question" | "language" | "outcome">,
): DiceV03Presentation {
  if (result.language !== fixture.language) {
    throw new Error("DICE_V03_PRESENTATION_IDENTITY_MISMATCH");
  }
  const planet = face(PLANET_FACES, fixture.outcome.planet);
  const sign = face(SIGN_FACES, fixture.outcome.sign);
  const house = face(HOUSE_FACES, fixture.outcome.house);
  const request = buildDiceInterpretationRequest(fixture.question, { planet, sign, house });
  const zh = result.language === "zh-Hant";
  const opening = zh
    ? `你抽到${planet.zh}落在${sign.zh}及${house.zh} — ${result.planet_layer}；透過${result.sign_element_layer}表達，並落在${result.house_layer}的外在環境。`
    : `You drew ${planet.en} in ${sign.en} in the ${house.en} — ${result.planet_layer}, expressed through ${result.sign_element_layer}, landing in ${result.house_layer}.`;
  const reading = [
    zh ? `就「${fixture.question}」而言，${result.planet_layer}${result.sign_element_layer}${result.house_layer}` : `For “${fixture.question}”, ${result.planet_layer} ${result.sign_element_layer} ${result.house_layer}`,
    result.judgment,
    result.timing_or_pace,
  ].filter((value): value is string => Boolean(value)).join(zh ? "" : " ");
  const houseWatch = zh
    ? request.symbols.house.meaning.zhRef.split("／").at(-1)?.trim()
    : request.symbols.house.meaning.watchOut;
  if (!houseWatch) throw new Error("DICE_V03_PRESENTATION_WATCH_MISSING");
  const watch = zh
    ? `就「${fixture.question}」需要留意：${result.sign_element_layer}可能令${houseWatch}這項外在風險更明顯。`
    : `For “${fixture.question}”, watch for ${result.sign_element_layer} amplifying this external risk: ${houseWatch}.`;
  const headings = zh
    ? ["解讀", "需要留意", "實際一步"]
    : ["Reading", "One thing to watch", "Practical step"];
  return Object.freeze({
    opening,
    sections: Object.freeze([
      Object.freeze({ heading: headings[0], body: reading }),
      Object.freeze({ heading: headings[1], body: watch }),
      Object.freeze({ heading: headings[2], body: result.practical_direction }),
    ]),
  });
}
