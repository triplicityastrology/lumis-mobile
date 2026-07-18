export function isValidBirthDate(
  value: string,
  today = new Date(),
  timeZone = "UTC"
): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match || Number.isNaN(today.getTime())) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const birthDateUtc = Date.UTC(year, month - 1, day);
  const parsedDate = new Date(birthDateUtc);
  const localToday = calendarDateInTimeZone(today, timeZone);

  if (!localToday) return false;

  const todayUtc = Date.UTC(localToday.year, localToday.month - 1, localToday.day);

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day &&
    birthDateUtc <= todayUtc
  );
}

export function runtimeTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function calendarDateInTimeZone(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const year = Number(values.year);
    const month = Number(values.month);
    const day = Number(values.day);

    return Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)
      ? { year, month, day }
      : null;
  } catch {
    return null;
  }
}
