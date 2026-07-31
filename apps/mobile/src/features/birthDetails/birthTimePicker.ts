export function parseBirthTimePickerValue(value: string): Date {
  const result = new Date(2000, 0, 1, 12, 0, 0, 0);
  const twelveHour = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim());

  if (twelveHour) {
    let hour = Number(twelveHour[1]) % 12;
    if (twelveHour[3].toUpperCase() === "PM") hour += 12;
    result.setHours(hour, Number(twelveHour[2]), 0, 0);
    return result;
  }

  const twentyFourHour = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (twentyFourHour) {
    result.setHours(Number(twentyFourHour[1]), Number(twentyFourHour[2]), 0, 0);
  }

  return result;
}

export function formatBirthTimePickerValue(value: Date): string {
  const hour24 = value.getHours();
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(value.getMinutes()).padStart(2, "0")} ${suffix}`;
}

export function resolveBirthTimePickerCommit(input: {
  currentValue: string;
  stagedValue: Date;
  accepted: boolean;
}): string {
  return input.accepted
    ? formatBirthTimePickerValue(input.stagedValue)
    : input.currentValue;
}
