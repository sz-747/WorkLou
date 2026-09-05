/**
 * Today view model — a roll-up of the real casework tables. "Needs attention"
 * is overdue follow-ups plus cases still waiting on an approved context;
 * follow-ups and letters reuse their own view models.
 */
import { getClientRows } from "./clients";
import { getFollowUpRows, type FollowUpRow } from "./follow-ups";
import { getLetterRows, type LetterRow } from "./letters";
import { joinParts } from "./format";

export type AttentionRow = {
  key: string;
  name: string;
  detail: string;
  meta: string;
  overdue: boolean;
};

export type TodayView = {
  subline: string;
  needsAttention: AttentionRow[];
  followUps: FollowUpRow[];
  letters: LetterRow[];
};

export async function getTodayView(now: Date = new Date()): Promise<TodayView> {
  const [clients, followUps, letters] = await Promise.all([
    getClientRows(now),
    getFollowUpRows(now),
    getLetterRows(now),
  ]);

  const needsAttention: AttentionRow[] = clients
    .filter((client) => client.nextOverdue || client.focus === "–")
    .map((client) => ({
      key: client.id,
      name: client.ref,
      detail: joinParts([client.stage, client.focus === "–" ? "context not extracted" : null]),
      meta: client.nextOverdue ? client.next : "needs context",
      overdue: client.nextOverdue,
    }));

  const dateLine = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  return {
    subline: joinParts([
      dateLine,
      `${clients.length} open case${clients.length === 1 ? "" : "s"}`,
      `${needsAttention.length} need attention`,
      `${followUps.length} follow-up${followUps.length === 1 ? "" : "s"} due`,
    ]),
    needsAttention,
    followUps,
    letters,
  };
}
