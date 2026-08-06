'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function SearchButton({ initialUpdatedAt }: { initialUpdatedAt: string | null }) {
  const [status, setStatus] = useState<'idle' | 'searching' | 'error'>('idle');
  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevUpdatedAt = useRef(initialUpdatedAt);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPolling = () => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/results', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.updatedAt && data.updatedAt !== prevUpdatedAt.current) {
          prevUpdatedAt.current = data.updatedAt;
          stopPolling();
          setStatus('idle');
          router.refresh();
        }
      } catch { /* ignore */ }
    }, 4000);
  };

  const handleSearch = async () => {
    setStatus('searching');
    try {
      await fetch('/api/search', { method: 'POST' });
    } catch { /* trigger attempt failed, still poll */ }
    startPolling();
    setTimeout(() => {
      stopPolling();
      setStatus((s) => s === 'searching' ? 'error' : s);
    }, 120_000);
  };

  useEffect(() => () => stopPolling(), []);

  if (status === 'searching') {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full"
      >
        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        조회 중
      </button>
    );
  }

  return (
    <button
      onClick={handleSearch}
      className={`text-xs px-3 py-1.5 rounded-full font-medium transition active:scale-95 ${
        status === 'error'
          ? 'bg-red-900/50 text-red-400 border border-red-700/50'
          : 'bg-sky-500/20 text-sky-400 border border-sky-500/40 hover:bg-sky-500/30'
      }`}
    >
      {status === 'error' ? '재시도' : '지금 조회하기'}
    </button>
  );
}
