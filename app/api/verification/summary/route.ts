import { NextResponse } from 'next/server';
import { pendingChanges, verificationSummary } from '@/lib/verify';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [summary, changes] = await Promise.all([verificationSummary(), pendingChanges()]);
  return NextResponse.json({ summary, changes });
}
