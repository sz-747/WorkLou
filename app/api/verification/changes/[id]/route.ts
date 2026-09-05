import { NextResponse } from 'next/server';
import { reviewChange } from '@/lib/verify';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { decision } = await req.json();
  if (!['approve', 'reject'].includes(decision)) {
    return NextResponse.json({ error: 'decision must be approve or reject' }, { status: 400 });
  }
  const ok = await reviewChange(Number(id), decision);
  if (!ok) return NextResponse.json({ error: 'change not found or already reviewed' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
