import { NextResponse } from 'next/server';

const TRIGGER_ID = 'trig_01SGEsfHMZX9WBpDieqm94DQ';

export async function POST() {
  const apiKey = process.env.CLAUDE_CODE_API_KEY;
  if (apiKey) {
    try {
      await fetch(`https://api.claude.ai/v1/code/triggers/${TRIGGER_ID}/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      });
    } catch { /* silent */ }
  }
  // 트리거 성공 여부와 관계없이 클라이언트는 폴링 시작
  return NextResponse.json({ status: 'polling_started' });
}
