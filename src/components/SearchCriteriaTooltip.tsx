'use client';
import { useState, useEffect, useRef } from 'react';

export function SearchCriteriaTooltip() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="text-[11px] text-slate-600 hover:text-slate-400 transition underline underline-offset-2"
      >
        검색 기준
      </button>
      {open && (
        <div className="absolute left-0 top-5 z-20 bg-slate-800 border border-slate-700 rounded-2xl p-3.5 w-56 shadow-2xl">
          <p className="text-xs font-semibold text-slate-300 mb-2">일본 노선 검색 기준</p>
          <div className="space-y-1.5 text-xs text-slate-400">
            <p>도쿄 · 오사카 · 후쿠오카 · 나고야 · 삿포로 · 구마모토 · 오키나와</p>
            <p className="text-slate-500 pt-1 border-t border-slate-700">이번달~다음달 (62일 이내) 중 도시별 최저가 출발일 · 직항 3박</p>
          </div>
        </div>
      )}
    </div>
  );
}
