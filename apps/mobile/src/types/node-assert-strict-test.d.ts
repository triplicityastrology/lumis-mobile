declare module "node:assert/strict" {
  type Assert = Readonly<{
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
  }>;

  const assert: Assert;
  export default assert;
}
