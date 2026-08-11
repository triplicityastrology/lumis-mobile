import { getEncoding } from "js-tiktoken";

export const DICE_TOKENIZER_VERSION = "o200k_base" as const;
export const DICE_TOKENIZER_PACKAGE = "npm:js-tiktoken@1.0.21" as const;

const encoding = getEncoding(DICE_TOKENIZER_VERSION);

export type DiceTokenMeasurement = Readonly<{
  tokenizer: typeof DICE_TOKENIZER_VERSION;
  token_ids: readonly number[];
  token_count: number;
  within_limit: boolean;
}>;

export const diceServerTokenizer = Object.freeze({
  version: DICE_TOKENIZER_VERSION,
  encode(value: string): readonly number[] {
    return encoding.encode(value);
  },
  count(value: string): number {
    return encoding.encode(value).length;
  },
});

export function measureDiceTokenLimit(value: string, maximum: number): DiceTokenMeasurement {
  if (!Number.isInteger(maximum) || maximum < 0) throw new Error("DICE_TOKEN_LIMIT_INVALID");
  const tokenIds = Object.freeze([...diceServerTokenizer.encode(value)]);
  return Object.freeze({
    tokenizer: DICE_TOKENIZER_VERSION,
    token_ids: tokenIds,
    token_count: tokenIds.length,
    within_limit: tokenIds.length <= maximum,
  });
}
