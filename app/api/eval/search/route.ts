import { NextResponse } from 'next/server';
import { latestEvalResult, runSearchEval } from '@/lib/eval';

export const dynamic = 'force-dynamic';

// Latest persisted result (written by manual runs and the background scheduler).
export async function GET() {
  const result = await latestEvalResult('search');
  return NextResponse.json(result);
}

export async function POST() {
  const result = await runSearchEval();
  return NextResponse.json(result);
}
