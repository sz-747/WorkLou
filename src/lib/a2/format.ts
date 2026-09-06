/**
 * Presentation helpers for the A2 screens. All dates are rendered in Lou's
 * Place's operating timezone (see lib/dates.ts) — never the server's.
 */
import { addSydneyCalendarDays, sydneyDate } from "../dates";

const TZ = "Australia/Sydney";

/** "09:25" in Sydney time. */
export function timeLabel(value: Date | string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

/** "2 Sep" in Sydney time. */
export function shortDate(value: Date | string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

/** "today" · "yesterday" · "2 Sep". */
export function dayLabel(value: Date | string, now: Date = new Date()): string {
  const day = sydneyDate(value);
  if (day === sydneyDate(now)) return "today";
  if (day === addSydneyCalendarDays(now, -1)) return "yesterday";
  return shortDate(value);
}

/** "today 09:25" · "yesterday" · "2 Sep" — how a contact time reads in a row. */
export function contactLabel(value: Date | string | null, now: Date = new Date()): string {
  if (!value) return "–";
  const label = dayLabel(value, now);
  return label === "today" ? `today ${timeLabel(value)}` : label;
}

/** Whole days a due date is past, 0 when it is today or in the future. */
export function daysOverdue(due: string, now: Date = new Date()): number {
  const today = sydneyDate(now);
  if (due >= today) return 0;
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** "Overdue 9 days" · "today" · "8 Sep" for a follow-up due date. */
export function dueLabel(due: string | null, now: Date = new Date()): string {
  if (!due) return "–";
  const overdue = daysOverdue(due, now);
  if (overdue === 1) return "Overdue 1 day";
  if (overdue > 1) return `Overdue ${overdue} days`;
  if (due === sydneyDate(now)) return "today";
  return shortDate(`${due}T12:00:00Z`);
}

/** Initials for the avatar chip, from a name like "Maya Thompson". */
export function initialsOf(ref: string): string {
  const parts = ref.split(/[\s\-_]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const last = parts[parts.length - 1];
  return (parts[0][0] + (last === parts[0] ? (parts[0][1] ?? "") : last[0])).toUpperCase();
}

/**
 * How a woman is named on screen. Every worker-facing surface uses her name;
 * client_ref is only the data label, so it is the fallback when no name is
 * recorded yet.
 */
export function displayName(row: { clientName?: string | null; clientRef: string }): string {
  return row.clientName?.trim() || row.clientRef;
}

/** Her first name, for possessives and headings ("Needs attention · Amira"). */
export function firstNameOf(row: { clientName?: string | null; clientRef: string }): string {
  return displayName(row).split(/\s+/)[0];
}

/** "housing_accommodation" → "housing accommodation". */
export function humanise(value: string): string {
  return value.replace(/_/g, " ");
}

/** Join non-empty parts with the design's middot separator. */
export function joinParts(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(" · ");
}
