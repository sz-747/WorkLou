/**
 * Phase 6 — Documentation (step 5B).
 * Drafts a case note from stored case data ONLY: the original appointment
 * notes, the approved context (woman-stated and worker-observed fields kept
 * apart using the stored field tags), referral actions, provider
 * confirmations from Verify, and follow-up/outcome activity from step 5A.
 * The LLM only arranges stored data into sections; the worker reviews,
 * edits, and approves. The original notes are never modified.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import {
  caseDocuments,
  providerConfirmationEvents,
  services,
  type CaseContext,
} from "../db/schema";
import { chatCompletionsUrl, fetchLlm } from "./extraction";
import { CONTEXT_FIELDS, fieldSourceOf, fieldValuePreview } from "./context-fields";
import { factLabel } from "./verify";
import { outcomeLabel } from "./followup";
import { sydneyDate } from "./dates";

export type CaseDocumentRow = {
  id: string;
  caseId: string;
  draftText: string;
  status: string;
  createdAt: Date;
  approvedAt: Date | null;
};

/** All documents for a case, newest first. */
export async function getCaseDocuments(caseId: string): Promise<CaseDocumentRow[]> {
  return db
    .select({
      id: caseDocuments.id,
      caseId: caseDocuments.caseId,
      draftText: caseDocuments.draftText,
      status: caseDocuments.status,
      createdAt: caseDocuments.createdAt,
      approvedAt: caseDocuments.approvedAt,
    })
    .from(caseDocuments)
    .where(eq(caseDocuments.caseId, caseId))
    .orderBy(desc(caseDocuments.createdAt));
}

/** Provider confirmations recorded in Verify for the services this case referred to. */
export async function getProviderConfirmationsForCase(
  caseId: string,
): Promise<
  { serviceName: string; fact: string; confirmedBy: string; confirmedAt: Date }[]
> {
  const rows = await db
    .select({
      serviceName: services.name,
      key: providerConfirmationEvents.key,
      value: providerConfirmationEvents.value,
      confirmedBy: providerConfirmationEvents.confirmedBy,
      confirmedAt: providerConfirmationEvents.confirmedAt,
    })
    .from(providerConfirmationEvents)
    .innerJoin(services, eq(providerConfirmationEvents.serviceId, services.id))
    .where(eq(providerConfirmationEvents.caseId, caseId))
    .orderBy(desc(providerConfirmationEvents.confirmedAt));
  return rows.map((r) => ({
      serviceName: r.serviceName,
      fact: `${factLabel(r.key)}: ${r.value}`,
      confirmedBy: r.confirmedBy,
      confirmedAt: r.confirmedAt,
    }));
}

/** The exact input to the case-note LLM — stored data only. */
export type CaseNoteInput = {
  clientRef: string;
  appointmentDate: string;
  originalNotes: string;
  womanStated: { field: string; value: string }[];
  workerObservations: { field: string; value: string }[];
  referrals: {
    serviceName: string;
    status: string;
    sentAt: string | null;
    outcome: string | null;
    outcomeNotes: string | null;
    followUpDue: string | null;
    text: string | null;
  }[];
  providerConfirmations: { serviceName: string; fact: string; confirmedBy: string; confirmedAt: string }[];
  followUpActivity: { date: string; kind: string; note: string }[];
};

const isoDate = (d: Date | string | null) => (d ? sydneyDate(d) : null);

/**
 * Pure: build the case-note input from stored data. Woman-stated and
 * worker-observed context fields are kept apart using the stored field tags
 * so "Woman said" never contains caseworker observations. Follow-up drafts
 * are not activity — only provider responses and outcomes enter.
 */
export function buildCaseNoteInput(stored: {
  clientRef: string;
  appointmentAt: Date | string;
  originalNotes: string;
  context: CaseContext | null;
  referrals: {
    serviceName: string;
    status: string;
    sentAt: Date | string | null;
    draftText: string | null;
    outcome: string | null;
    outcomeNotes: string | null;
    followUpDue: string | null;
  }[];
  confirmations: { serviceName: string; fact: string; confirmedBy: string; confirmedAt: Date | string }[];
  events: { kind: string; note: string; occurredAt: Date | string }[];
}): CaseNoteInput {
  const womanStated: { field: string; value: string }[] = [];
  const workerObservations: { field: string; value: string }[] = [];
  if (stored.context) {
    for (const f of CONTEXT_FIELDS) {
      const value = fieldValuePreview(f.key, stored.context);
      if (value === null) continue;
      const target = fieldSourceOf(stored.context, f.key) === "woman_stated" ? womanStated : workerObservations;
      target.push({ field: f.label, value });
    }
  }
  return {
    clientRef: stored.clientRef,
    appointmentDate: isoDate(stored.appointmentAt)!,
    originalNotes: stored.originalNotes,
    womanStated,
    workerObservations,
    referrals: stored.referrals.map((r) => ({
      serviceName: r.serviceName,
      status: r.status,
      sentAt: isoDate(r.sentAt),
      outcome: r.outcome ? outcomeLabel(r.outcome) : null,
      outcomeNotes: r.outcomeNotes,
      followUpDue: r.followUpDue,
      text: r.draftText,
    })),
    providerConfirmations: stored.confirmations.map((c) => ({
      serviceName: c.serviceName,
      fact: c.fact,
      confirmedBy: c.confirmedBy,
      confirmedAt: isoDate(c.confirmedAt)!,
    })),
    followUpActivity: stored.events
      .filter((e) => e.kind === "provider_response" || e.kind === "outcome")
      .map((e) => ({
        date: isoDate(e.occurredAt)!,
        kind: e.kind === "provider_response" ? "provider response" : "outcome recorded",
        note: e.note,
      })),
  };
}

const NOTE_SYSTEM_PROMPT = `You draft a case note for a caseworker at Lou's Place from stored case data.
You receive JSON with: the case reference, the appointment date, the woman's original appointment notes (verbatim), the approved structured context split into woman-stated and caseworker-observed fields, the referrals made (service, status, dates, outcome and outcome notes, the text that was sent), provider confirmations recorded during verification, and follow-up/outcome activity.
STRICT RULES:
- Use ONLY the provided information. Never invent, infer, or embellish.
- In "Woman said", use only her own words from the original notes and woman-stated context fields. Never present caseworker observations as her words.
- Omit what is not provided rather than inventing it.
- Plain text, with exactly these section headings, in this order:
Woman said
Current concerns
Actions taken
Referrals
Worker observations
Next steps
- "Current concerns": needs, urgency, safety and related context from the provided data only.
- "Actions taken": provider confirmations recorded and referrals sent.
- "Referrals": one line per referral — service, date sent, status, outcome if recorded.
- "Next steps": only open follow-ups derivable from stored due dates and outstanding outcomes; write "None recorded" if there are none.`;

/** Call the configured LLM to draft the case note (worker reviews, edits, approves). */
export async function draftCaseNoteText(input: CaseNoteInput): Promise<string> {
  const base = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!base || !apiKey || !model) {
    throw new Error("LLM not configured (LLM_BASE_URL / LLM_API_KEY / LLM_MODEL missing)");
  }

  const res = await fetchLlm(chatCompletionsUrl(base), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: NOTE_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM request failed (HTTP ${res.status})`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new Error("LLM returned no content");
  return content.trim();
}

/** Deterministic six-section draft used when the LLM is unavailable. */
export function fallbackCaseNoteText(input: CaseNoteInput): string {
  const section = (title: string, items: string[]) =>
    [title, ...(items.length > 0 ? items : ["None recorded"])].join("\n");
  return [
    section("Woman said", [input.originalNotes, ...input.womanStated.map((item) => `${item.field}: ${item.value}`)].filter(Boolean)),
    section("Current concerns", []),
    section("Actions taken", input.providerConfirmations.map((item) => `${item.serviceName}: ${item.fact}`)),
    section("Referrals", input.referrals.map((item) => `${item.serviceName}: ${item.status}${item.outcome ? `, ${item.outcome}` : ""}`)),
    section("Worker observations", input.workerObservations.map((item) => `${item.field}: ${item.value}`)),
    section("Next steps", input.referrals.filter((item) => item.status !== "closed" && item.followUpDue).map((item) => `Follow up ${item.serviceName} by ${item.followUpDue}`)),
  ].join("\n\n");
}

/** Store a new case-note draft. Nothing is ever transmitted or final here. */
export async function insertDocumentDraft(caseId: string, draftText: string) {
  const [row] = await db
    .insert(caseDocuments)
    .values({ caseId, draftText })
    .returning({ id: caseDocuments.id });
  return row.id;
}

/** Worker edits a draft. Drafts only — approved documents are never edited. */
export async function saveDocumentDraftText(documentId: string, draftText: string): Promise<boolean> {
  const trimmed = draftText.trim();
  if (!trimmed) return false;
  const updated = await db
    .update(caseDocuments)
    .set({ draftText: trimmed })
    .where(and(eq(caseDocuments.id, documentId), eq(caseDocuments.status, "draft")))
    .returning({ id: caseDocuments.id });
  return updated.length > 0;
}

/** Worker approves a draft — it becomes the final case note. Drafts only. */
export async function approveDocument(documentId: string): Promise<boolean> {
  const updated = await db
    .update(caseDocuments)
    .set({ status: "approved", approvedAt: new Date() })
    .where(and(eq(caseDocuments.id, documentId), eq(caseDocuments.status, "draft")))
    .returning({ id: caseDocuments.id });
  return updated.length > 0;
}
