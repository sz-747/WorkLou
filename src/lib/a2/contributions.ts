import { sydneyDate } from "../dates";

export type ContributionDay = {
  date: string;
  label: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  detail: string;
};

export type ContributionsView = {
  today: number;
  thisMonth: number;
  lastYear: number;
  activeDays: number;
  days: ContributionDay[];
};

const DAY_MS = 86_400_000;
const ACTIVITY_PATTERN = [0, 1, 2, 0, 3, 1, 4, 2, 1, 0, 2, 3, 1, 5];

function countFor(date: Date, index: number, isToday: boolean): number {
  if (isToday) return 6;
  const weekday = date.getUTCDay();
  const patterned = ACTIVITY_PATTERN[(date.getUTCDate() + date.getUTCMonth() * 3 + index) % ACTIVITY_PATTERN.length];
  return weekday === 0 || weekday === 6 ? (patterned >= 4 ? 1 : 0) : patterned;
}

function activityLevel(count: number): ContributionDay["level"] {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

/** Stable synthetic contribution activity for the local demo. */
export function getContributionsView(now: Date = new Date()): ContributionsView {
  const todayDate = sydneyDate(now);
  const end = new Date(`${todayDate}T12:00:00Z`);
  const start = new Date(end.getTime() - 364 * DAY_MS);
  const monthKey = todayDate.slice(0, 7);

  const days = Array.from({ length: 365 }, (_, index): ContributionDay => {
    const date = new Date(start.getTime() + index * DAY_MS);
    const iso = date.toISOString().slice(0, 10);
    const count = countFor(date, index, iso === todayDate);
    const referrals = count ? Math.max(1, Math.round(count * 0.55)) : 0;
    const followUps = count ? Math.max(0, count - referrals) : 0;
    const dateLabel = new Intl.DateTimeFormat("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);

    return {
      date: iso,
      label: dateLabel,
      count,
      level: activityLevel(count),
      detail: count
        ? `${count} ${count === 1 ? "woman" : "women"} helped · ${referrals} referrals · ${followUps} follow-ups`
        : "No support activity recorded",
    };
  });

  const thisMonth = days.filter((day) => day.date.startsWith(monthKey)).reduce((sum, day) => sum + day.count, 0);
  const lastYear = days.reduce((sum, day) => sum + day.count, 0);

  return {
    today: days.at(-1)?.count ?? 0,
    thisMonth,
    lastYear,
    activeDays: days.filter((day) => day.count > 0).length,
    days,
  };
}
