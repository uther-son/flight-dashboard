'use client';

import { useState } from 'react';
import type { FlightDeal } from '@/lib/types';
import { DealCard } from './DealCard';

const PAGE_SIZE = 5;

export function ExpandableDealList({ deals, threshold }: { deals: FlightDeal[]; threshold?: number }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (deals.length === 0) return null;

  const visible = deals.slice(0, visibleCount);
  const hasMore = visibleCount < deals.length;

  return (
    <>
      {visible.map((deal, i) => <DealCard key={i} deal={deal} threshold={threshold} />)}
      {deals.length > PAGE_SIZE && (
        hasMore ? (
          <button
            onClick={() => setVisibleCount(c => Math.min(c + PAGE_SIZE, deals.length))}
            className="w-full text-xs text-gray-400 border border-gray-700 rounded-lg py-2 mt-1 hover:border-gray-500 transition"
          >
            더보기 ({deals.length - visibleCount}개 더) ▾
          </button>
        ) : (
          <p className="text-xs text-gray-600 text-center py-2">마지막 내역입니다</p>
        )
      )}
    </>
  );
}
