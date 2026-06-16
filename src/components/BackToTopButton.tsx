'use client';

import { COLLAPSE_ALL_EVENT } from './ExpandableDealList';

export function BackToTopButton() {
  const handleClick = () => {
    window.dispatchEvent(new Event(COLLAPSE_ALL_EVENT));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      onClick={handleClick}
      className="w-full text-xs text-gray-400 border border-gray-700 rounded-lg py-2.5 mt-6 hover:border-gray-500 transition"
    >
      ↑ 맨 위로 가기
    </button>
  );
}
