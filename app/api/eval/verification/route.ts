import { NextResponse } from 'next/server';
import { latestEvalResult, runVerificationEval } from '@/lib/eval';

export const dynamic = 'force-dynamic';

// Latest persisted result (written by manual runs and the background scheduler).
export async function GET() {
  const result = await latestEvalResult('verification');
  return NextResponse.json(result);
}

export async function POST() {
  const result = await runVerificationEval();
  return NextResponse.json(result);
}
