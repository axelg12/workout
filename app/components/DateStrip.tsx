"use client";

import { useRouter } from "next/navigation";
import { formatLong } from "@/lib/dates";

export function DateStrip({
  date,
  prev,
  next,
  isToday,
  today,
}: {
  date: string;
  prev: string | null;
  next: string | null;
  isToday: boolean;
  today: string;
}) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-[var(--background)]/90 px-4 py-3 backdrop-blur dark:border-zinc-800/70">
      <div className="flex items-center justify-between gap-2">
        <button
          aria-label="Previous day"
          disabled={!prev}
          onClick={() => prev && router.push(`/day/${prev}`)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-zinc-600 disabled:opacity-30 dark:text-zinc-300"
        >
          ‹
        </button>

        <div className="flex flex-col items-center">
          <span className="text-[15px] font-semibold">{formatLong(date)}</span>
          {!isToday && (
            <button
              onClick={() => router.push(`/day/${today}`)}
              className="mt-0.5 text-xs font-medium text-blue-500"
            >
              Go to today
            </button>
          )}
          {isToday && (
            <span className="mt-0.5 text-xs font-medium text-emerald-500">Today</span>
          )}
        </div>

        <button
          aria-label="Next day"
          disabled={!next}
          onClick={() => next && router.push(`/day/${next}`)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-zinc-600 disabled:opacity-30 dark:text-zinc-300"
        >
          ›
        </button>
      </div>

      <div className="mt-2 flex justify-center">
        <label className="relative text-xs text-zinc-500">
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && router.push(`/day/${e.target.value}`)}
            className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
          />
        </label>
      </div>
    </header>
  );
}
