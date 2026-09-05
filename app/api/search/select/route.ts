import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { searchId, serviceId, elapsedMs } = await req.json();
  if (!Number.isInteger(searchId) || !Number.isInteger(serviceId)) {
    return NextResponse.json({ error: 'searchId and serviceId required' }, { status: 400 });
  }
  await pool.query(
    `UPDATE referral_searches SET selected_service_id = $1, selected_after_ms = $2 WHERE id = $3`,
    [serviceId, typeof elapsedMs === 'number' ? Math.round(elapsedMs) : null, searchId]
  );
  return NextResponse.json({ ok: true });
}
