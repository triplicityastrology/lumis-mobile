import { isValidBirthDate } from "./birth-date";

const referenceDate = new Date("2026-07-17T16:36:00.000Z");

const cases = [
  { value: "2026-07-18", timeZone: "Asia/Hong_Kong", expected: true, name: "UTC+8 today boundary" },
  { value: "2026-07-19", timeZone: "Asia/Hong_Kong", expected: false, name: "UTC+8 tomorrow boundary" },
  { value: "2026-07-17", timeZone: "America/New_York", expected: true, name: "UTC-4 today boundary" },
  { value: "2026-07-18", timeZone: "America/New_York", expected: false, name: "UTC-4 tomorrow boundary" },
  { value: "2026-07-18", timeZone: "Pacific/Kiritimati", expected: true, name: "UTC+14 boundary" },
  { value: "2026-07-17", timeZone: "Pacific/Honolulu", expected: true, name: "UTC-10 boundary" },
  { value: "2099-01-01", timeZone: "Asia/Hong_Kong", expected: false, name: "future year" },
  { value: "2000-02-29", timeZone: "UTC", expected: true, name: "valid leap day" },
  { value: "1900-02-29", timeZone: "UTC", expected: false, name: "invalid century leap day" },
  { value: "2026-02-29", timeZone: "UTC", expected: false, name: "invalid calendar day" },
  { value: "2026-7-18", timeZone: "UTC", expected: false, name: "malformed date" },
  { value: "2026-07-17", timeZone: "Not/A_Timezone", expected: false, name: "invalid timezone" }
] as const;

for (const testCase of cases) {
  const actual = isValidBirthDate(testCase.value, referenceDate, testCase.timeZone);
  if (actual !== testCase.expected) {
    throw new Error(`${testCase.name}: expected ${testCase.expected}, received ${actual}.`);
  }
}
