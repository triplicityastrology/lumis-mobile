"use strict";

// Offline protocol-test substitute only. Production Edge resolution uses the
// pinned js-tiktoken package from pnpm/Supabase's npm resolver.
exports.getEncoding = function getEncoding(name) {
  if (name !== "o200k_base") throw new Error("TEST_TOKENIZER_ENCODING_INVALID");
  return Object.freeze({
    encode(value) {
      if (value === "hello") return [24912];
      if (value === "你好🙂") return [177519, 37459];
      const tokens = value.match(/ ?[A-Za-z_]+| ?\d+|[\u3400-\u9fff\uf900-\ufaff]|[^\s]/gu) ?? [];
      return tokens.map((_, index) => index + 1);
    },
  });
};
