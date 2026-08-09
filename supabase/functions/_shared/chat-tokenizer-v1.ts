import { getEncoding } from "js-tiktoken";

export const CHAT_TOKENIZER_VERSION = "o200k_base" as const;

export type ChatServerTokenizer = Readonly<{
  version: typeof CHAT_TOKENIZER_VERSION;
  count(text: string): number;
}>;

const encoding = getEncoding(CHAT_TOKENIZER_VERSION);

export const chatServerTokenizer: ChatServerTokenizer = Object.freeze({
  version: CHAT_TOKENIZER_VERSION,
  count(text: string): number {
    return encoding.encode(text).length;
  }
});
