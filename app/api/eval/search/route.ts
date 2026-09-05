import { NextResponse } from 'next/server';
import { runSearchEval } from '@/lib/eval';

export const dynamic = 'force-dynamic';

export async function POST() {
  const result = await runSearchEval();
  return NextResponse.json(result);
}
