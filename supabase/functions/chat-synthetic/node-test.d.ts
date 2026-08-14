declare module "node:assert" {
  export const strict: {
    equal(actual: unknown, expected: unknown): void;
    deepEqual(actual: unknown, expected: unknown): void;
  };
}

declare module "node:crypto" {
  export function createHash(algorithm: "sha256"): {
    update(value: string): { digest(encoding: "hex"): string };
  };
}
