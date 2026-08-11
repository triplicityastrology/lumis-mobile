declare module "js-tiktoken" {
  export function getEncoding(name: "o200k_base"): Readonly<{
    encode(value: string): readonly number[];
  }>;
}
