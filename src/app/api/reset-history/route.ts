import { NextResponse } from 'next/server';

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export async function POST() {
  if (!url || !token) return NextResponse.json({ error: 'no upstash env' }, { status: 500 });
  await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['SET', 'flight_history', '{}']]),
  });
  return NextResponse.json({ ok: true });
}
