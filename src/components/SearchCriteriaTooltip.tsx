'use client';
import { useState, useEffect, useRef } from 'react';

interface Props {
  searchDates?: { plus14: string; plus30: string; plus45: string };
}

export function SearchCriteriaTooltip({ searchDates }: Props) {
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
        <div className="absolute left-0 top-5 z-20 bg-slate-800 border border-slate-700 rounded-2xl p-3.5 w-52 shadow-2xl">
          <p className="text-xs font-semibold text-slate-300 mb-2">출발일 기준</p>
          {searchDates ? (
            <div className="space-y-1.5 text-xs text-slate-400">
              <p><span className="text-slate-500 w-10 inline-block">+14일</span>{searchDates.plus14} 출발 · 3박</p>
              <p><span className="text-slate-500 w-10 inline-block">+30일</span>{searchDates.plus30} 출발 · 3박</p>
              <p><span className="text-slate-500 w-10 inline-block">+45일</span>{searchDates.plus45} 출발 · 3박</p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">오전 10시 자동 검색 후 표시됩니다</p>
          )}
        </div>
      )}
    </div>
  );
}
