import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { parseReferralQuery } from '@/lib/parse';
import { searchServices } from '@/lib/search';
import { allServices } from '@/lib/queries';
import { emptyCriteria, Criteria, SUBURBS, SERVICE_TYPE_VALUES } from '@/lib/types';

export const dynamic = 'force-dynamic';

function validCriteria(c: unknown): boolean {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  if (o.serviceType != null && !SERVICE_TYPE_VALUES.includes(o.serviceType as string)) return false;
  if (o.location != null && !Object.keys(SUBURBS).includes(o.location as string)) return false;
  if (o.urgency != null && !['today', 'this_week'].includes(o.urgency as string)) return false;
  for (const k of ['childrenAllowed', 'walkIn', 'appointmentRequired', 'referralRequired']) {
    if (o[k] != null && typeof o[k] !== 'boolean') return false;
  }
  return true;
}

export async function POST(req: Request) {
  const body = await req.json();
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  let criteria: Criteria | null = null;
  let parserSource: 'llm' | 'local' | 'manual' = 'manual';

  if (validCriteria(body.criteria)) {
    criteria = { ...emptyCriteria(), ...(body.criteria as Partial<Criteria>) };
  } else {
    if (!query) return NextResponse.json({ error: 'query or criteria required' }, { status: 400 });
    // The caseworker's notes from the call often hold details the short query misses
    // (children, suburb, urgency) — feed them to the parser so word matching is expansive.
    const searchText = notes ? `${query}\n\nCaseworker's notes from the call: ${notes}` : query;
    const parsed = await parseReferralQuery(searchText);
    criteria = parsed.criteria;
    parserSource = parsed.source;
  }

  const services = await allServices();
  const { full, partial } = searchServices(services, criteria);

  const save = await pool.query(
    `INSERT INTO referral_searches (query, caseworker_notes, parsed_criteria, corrected_criteria, result_ids)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      query || null,
      notes || null,
      body.criteria ? null : JSON.stringify(criteria),
      JSON.stringify(criteria),
      [...full.map((m) => m.id), ...partial.map((m) => m.id)],
    ]
  );

  return NextResponse.json({
    searchId: save.rows[0].id,
    criteria,
    parserSource,
    results: { full, partial },
  });
}
