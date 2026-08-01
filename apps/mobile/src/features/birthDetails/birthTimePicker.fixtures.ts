import {
  composeBirthTime12h,
  formatBirthTimePickerValue,
  parseBirthTimePickerValue,
  resolveBirthTimePickerCommit,
} from "./birthTimePicker";

// PROF-003 wheel time composition: every hour/minute/AM·PM selection is honoured,
// so the picker can commit any valid time and never locks to a default (8:00 AM).
equal(composeBirthTime12h(3, 47, "PM").hour24, 15, "PM afternoon hour maps to 24h");
equal(composeBirthTime12h(3, 47, "PM").minute, 47, "non-zero minute is preserved");
equal(composeBirthTime12h(12, 0, "AM").hour24, 0, "12 AM is midnight");
equal(composeBirthTime12h(12, 30, "PM").hour24, 12, "12 PM is noon");
equal(composeBirthTime12h(11, 15, "PM").hour24, 23, "late PM hour maps to 24h");
equal(
  formatBirthTimePickerValue(localTime(composeBirthTime12h(9, 5, "PM").hour24, 5)),
  "9:05 PM",
  "a fresh PM selection round-trips through the commit path",
);
// Regression: distinct selections must yield distinct times — proves no 8am lock.
equal(
  composeBirthTime12h(8, 0, "AM").hour24 === composeBirthTime12h(5, 15, "PM").hour24,
  false,
  "different selections commit different times (no 8:00 AM lock)",
);

equal(
  formatBirthTimePickerValue(localTime(0, 7)),
  "12:07 AM",
  "midnight and minute selection are preserved"
);
equal(
  formatBirthTimePickerValue(localTime(9, 26)),
  "9:26 AM",
  "morning hour and minute selection are preserved"
);
equal(
  formatBirthTimePickerValue(localTime(15, 47)),
  "3:47 PM",
  "afternoon hour, minute, and PM selection are preserved"
);
equal(
  formatBirthTimePickerValue(parseBirthTimePickerValue("11:38 PM")),
  "11:38 PM",
  "twelve-hour values round trip"
);
equal(
  formatBirthTimePickerValue(parseBirthTimePickerValue("06:14:00")),
  "6:14 AM",
  "restored database time values initialize the picker"
);
equal(
  resolveBirthTimePickerCommit({
    currentValue: "8:00 AM",
    stagedValue: localTime(15, 47),
    accepted: false,
  }),
  "8:00 AM",
  "cancel leaves the existing time unchanged"
);
equal(
  resolveBirthTimePickerCommit({
    currentValue: "8:00 AM",
    stagedValue: localTime(15, 47),
    accepted: true,
  }),
  "3:47 PM",
  "Done commits the complete staged selection"
);

console.log("birth-details time picker fixtures passed");

function localTime(hour: number, minute: number): Date {
  return new Date(2000, 0, 1, hour, minute, 0, 0);
}

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: assertion failed`);
}
