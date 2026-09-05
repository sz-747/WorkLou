import { NextResponse } from 'next/server';
import { runVerification } from '@/lib/verify';

export const dynamic = 'force-dynamic';

async function handle(trigger: string) {
  const summary = await runVerification(trigger);
  return NextResponse.json(summary);
}

export async function POST(req: Request) {
  let trigger = 'manual';
  try {
    const body = await req.formData();
    trigger = String(body.get('trigger') || 'manual');
  } catch {
    try {
      const body = await req.json();
      trigger = body?.trigger || 'manual';
    } catch {}
  }
  if (!['scheduled', 'manual'].includes(trigger)) trigger = 'manual';
  return handle(trigger);
}

export async function GET() {
  return handle('scheduled');
}
