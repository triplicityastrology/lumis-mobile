import { isValidBirthDate } from "./birth-date";

const referenceDate = new Date("2026-07-18T12:00:00.000Z");

const cases = [
  { value: "2026-07-18", expected: true, name: "today boundary" },
  { value: "2026-07-19", expected: false, name: "tomorrow boundary" },
  { value: "2099-01-01", expected: false, name: "future year" },
  { value: "2000-02-29", expected: true, name: "valid leap day" },
  { value: "1900-02-29", expected: false, name: "invalid century leap day" },
  { value: "2026-02-29", expected: false, name: "invalid calendar day" },
  { value: "2026-7-18", expected: false, name: "malformed date" }
] as const;

for (const testCase of cases) {
  const actual = isValidBirthDate(testCase.value, referenceDate);
  if (actual !== testCase.expected) {
    throw new Error(`${testCase.name}: expected ${testCase.expected}, received ${actual}.`);
  }
}
