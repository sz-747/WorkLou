import { NextResponse } from 'next/server';
import { parseReferralQuery } from '@/lib/parse';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { query } = await req.json();
  if (!query || typeof query !== 'string' || !query.trim()) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }
  const result = await parseReferralQuery(query.trim());
  return NextResponse.json(result);
}
