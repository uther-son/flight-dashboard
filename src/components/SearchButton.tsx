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
    // 10분 후 타임아웃
    setTimeout(() => {
      stopPolling();
      setStatus((s) => s === 'searching' ? 'error' : s);
    }, 600_000);
  };

  useEffect(() => () => stopPolling(), []);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4">
      {status === 'error' && (
        <p className="text-center text-red-400 text-sm mb-3">
          검색 시간 초과. 다시 시도해주세요.
        </p>
      )}
      <button
        onClick={handleSearch}
        disabled={status === 'searching'}
        className={`w-full font-bold py-4 rounded-2xl shadow-lg transition active:scale-95 ${
          status === 'searching'
            ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-950'
        }`}
      >
        {status === 'searching' ? (
          <span className="flex items-center justify-center gap-3">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            검색 중...
          </span>
        ) : (
          '🔍 지금 검색하기'
        )}
      </button>
    </div>
  );
}
