import { NextResponse } from 'next/server';
import { getHistory } from '@/lib/storage';

export async function GET() {
  const history = await getHistory();
  return NextResponse.json(history);
}
