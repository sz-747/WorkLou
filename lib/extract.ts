import { ServiceRow } from './types';
import { pool } from './db';
import { llmJson, llmConfigured } from './llm';

// ---- Supported verified fields ----
export const VERIFIED_FIELDS = [
  'opening_hours',
  'phone',
  'address',
  'eligibility',
  'children_allowed',
  'walk_in_allowed',
  'referral_required',
] as const;

export type VerifiedField = (typeof VERIFIED_FIELDS)[number];

export interface ExtractedFacts {
  opening_hours?: string;
  phone?: string;
  address?: string;
  eligibility?: string;
  children_allowed?: boolean;
  walk_in_allowed?: boolean;
  referral_required?: boolean;
}

export interface FieldChange {
  field: VerifiedField;
  stored: string;
  extracted: string;
}

// ---- source fetching ----
export async function fetchSource(s: ServiceRow): Promise<{ text: string; ok: boolean }> {
  const fixture = await pool.query('SELECT content FROM source_fixtures WHERE service_id = $1', [s.id]);
  if (fixture.rows.length > 0) return { text: fixture.rows[0].content, ok: true };
  if (s.source_url && /^https?:\/\//.test(s.source_url)) {
    try {
      const res = await fetch(s.source_url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return { text: '', ok: false };
      const html = await res.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, '\n')
        .replace(/&amp;/g, '&')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n');
      return { text, ok: text.trim().length > 0 };
    } catch {
      return { text: '', ok: false };
    }
  }
  return { text: '', ok: false };
}

// ---- extraction ----
function line(text: string, label: RegExp): string | undefined {
  const m = text.match(label);
  return m?.[1]?.trim();
}

export function extractFactsRegex(text: string): ExtractedFacts {
  const f: ExtractedFacts = {};
  const oh = line(text, /opening hours:\s*([^\n]+)/i);
  if (oh) f.opening_hours = oh;
  const ph = line(text, /(?:phone|tel):\s*([^\n]+)/i);
  if (ph) f.phone = ph;
  const ad = line(text, /address:\s*([^\n]+)/i);
  if (ad) f.address = ad;
  const el = line(text, /eligibility:\s*([^\n]+)/i);
  if (el) f.eligibility = el;
  const ch = line(text, /children welcome:\s*([^\n]+)/i);
  if (ch && /^yes$/i.test(ch.trim())) f.children_allowed = true;
  else if (ch && /^no$/i.test(ch.trim())) f.children_allowed = false;
  const wi = line(text, /walk-ins?:\s*([^\n]+)/i);
  if (wi && /welcome/i.test(wi)) f.walk_in_allowed = true;
  else if (wi && /not accepted/i.test(wi)) f.walk_in_allowed = false;
  const rf = line(text, /referral needed:\s*([^\n]+)/i);
  if (rf && /^yes$/i.test(rf.trim())) f.referral_required = true;
  else if (rf && /^no$/i.test(rf.trim())) f.referral_required = false;
  return f;
}

const EXTRACT_PROMPT = `You extract factual service information from an official community service webpage.
Return ONLY a JSON object with keys (omit unknown ones):
opening_hours, phone, address, eligibility (strings), children_allowed, walk_in_allowed, referral_required (booleans).
Copy values exactly as stated. Never invent information. If a fact is not on the page, omit it.`;

export async function extractFacts(s: ServiceRow, text: string): Promise<ExtractedFacts> {
  if (llmConfigured()) {
    const raw = await llmJson(EXTRACT_PROMPT, `Service: ${s.name}\n\nPage content:\n${text.slice(0, 8000)}`);
    if (raw && typeof raw === 'object') return sanitizeExtracted(raw as Record<string, unknown>);
  }
  return extractFactsRegex(text);
}

function sanitizeExtracted(raw: Record<string, unknown>): ExtractedFacts {
  const f: ExtractedFacts = {};
  for (const k of ['opening_hours', 'phone', 'address', 'eligibility'] as const) {
    if (typeof raw[k] === 'string' && raw[k].trim()) f[k] = (raw[k] as string).trim();
  }
  for (const k of ['children_allowed', 'walk_in_allowed', 'referral_required'] as const) {
    if (raw[k] === true || raw[k] === false) f[k] = raw[k] as boolean;
  }
  return f;
}

// ---- comparison ----
function norm(v: string): string {
  return v.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
}
function normPhone(v: string): string {
  return v.replace(/\D/g, '');
}

export function compareFacts(s: ServiceRow, f: ExtractedFacts): FieldChange[] {
  const changes: FieldChange[] = [];
  const push = (field: VerifiedField, stored: string, extracted: string) => {
    changes.push({ field, stored, extracted });
  };

  const textPairs: [VerifiedField, string | null, string | undefined, boolean][] = [
    ['opening_hours', s.opening_hours, f.opening_hours, false],
    ['address', s.address, f.address, false],
    ['eligibility', s.eligibility, f.eligibility, false],
    ['phone', s.phone, f.phone, true],
  ];
  for (const [field, stored, extracted, isPhone] of textPairs) {
    if (stored == null || extracted == null) continue;
    const a = isPhone ? normPhone(stored) : norm(stored);
    const b = isPhone ? normPhone(extracted) : norm(extracted);
    if (a && b && a !== b) push(field, stored, extracted);
  }

  const boolPairs: [VerifiedField, boolean | null, boolean | undefined][] = [
    ['children_allowed', s.children_allowed, f.children_allowed],
    ['walk_in_allowed', s.walk_in_allowed, f.walk_in_allowed],
    ['referral_required', s.referral_required, f.referral_required],
  ];
  for (const [field, stored, extracted] of boolPairs) {
    if (stored == null || extracted == null) continue;
    if (stored !== extracted) push(field, stored ? 'yes' : 'no', extracted ? 'yes' : 'no');
  }

  return changes;
}

export const FIELD_COLUMNS: Record<VerifiedField, string> = {
  opening_hours: 'opening_hours',
  phone: 'phone',
  address: 'address',
  eligibility: 'eligibility',
  children_allowed: 'children_allowed',
  walk_in_allowed: 'walk_in_allowed',
  referral_required: 'referral_required',
};
