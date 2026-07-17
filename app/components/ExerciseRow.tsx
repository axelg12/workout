"use client";

import { useState } from "react";
import type { ExerciseWithLog } from "@/lib/queries";
import { formatShort } from "@/lib/dates";
import { ExerciseLogSheet } from "./ExerciseLogSheet";

export function ExerciseRow({
  exercise,
  date,
}: {
  exercise: ExerciseWithLog;
  date: string;
}) {
  const [open, setOpen] = useState(false);
  const log = exercise.log;
  const logged = Boolean(log?.actual || log?.done);

  return (
    <li>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
      >
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm ${
            logged
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-zinc-300 text-transparent dark:border-zinc-600"
          }`}
        >
          ✓
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-snug">{exercise.name}</span>
          {exercise.target && (
            <span className="block text-sm text-zinc-500">{exercise.target}</span>
          )}

          {log?.actual && (
            <span className="mt-1.5 block whitespace-pre-wrap rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-sm text-emerald-700 dark:text-emerald-300">
              {log.actual}
            </span>
          )}

          {exercise.insight?.trend && (
            <span className="mt-1.5 flex items-center gap-1.5 text-xs">
              <span
                className={
                  exercise.insight.trend === "up"
                    ? "font-semibold text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-400"
                }
              >
                {exercise.insight.trend === "up" && "↑"}
                {exercise.insight.trend === "down" && "↓"}
                {exercise.insight.trend === "same" && "→"}{" "}
                vs last time ({exercise.insight.prevTopWeightKg}kg)
              </span>
              {exercise.insight.isPr && (
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  PR
                </span>
              )}
            </span>
          )}

          {exercise.lastTime?.actual && (
            <span className="mt-1.5 block truncate text-xs text-zinc-400">
              Last ({formatShort(exercise.lastTime.date)}): {exercise.lastTime.actual}
            </span>
          )}
        </span>
      </button>

      {open && (
        <ExerciseLogSheet
          exercise={exercise}
          date={date}
          onClose={() => setOpen(false)}
        />
      )}
    </li>
  );
}
