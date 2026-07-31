import {
  formatBirthTimePickerValue,
  parseBirthTimePickerValue,
  resolveBirthTimePickerCommit,
} from "./birthTimePicker";

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
