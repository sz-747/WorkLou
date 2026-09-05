const SYDNEY_TIME_ZONE = "Australia/Sydney";

function sydneyParts(value: Date | string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: "year" | "month" | "day") =>
    Number(parts.find((item) => item.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

/** Calendar date in Lou's Place's operating timezone, never the server's timezone. */
export function sydneyDate(value: Date | string): string {
  const { year, month, day } = sydneyParts(value);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Add local calendar days without daylight-saving or UTC-midnight drift. */
export function addSydneyCalendarDays(value: Date | string, days: number): string {
  const { year, month, day } = sydneyParts(value);
  const safeNoonUtc = new Date(Date.UTC(year, month - 1, day + days, 12));
  return sydneyDate(safeNoonUtc);
}
