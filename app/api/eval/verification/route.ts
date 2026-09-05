import { NextResponse } from 'next/server';
import { runVerificationEval } from '@/lib/eval';

export const dynamic = 'force-dynamic';

export async function POST() {
  const result = await runVerificationEval();
  return NextResponse.json(result);
}
