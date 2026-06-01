"use client";

import { useActionState, startTransition, useState } from "react";
import type { DayLog } from "@/lib/schema";
import { logDay } from "@/app/actions";

export function DayLogBar({
  date,
  dayLog,
}: {
  date: string;
  dayLog: DayLog | null;
}) {
  const [feel, setFeel] = useState<number | null>(dayLog?.feel ?? null);
  const [expanded, setExpanded] = useState(false);

  const [, action, pending] = useActionState(async (_: void, formData: FormData) => {
    await logDay(formData);
    setExpanded(false);
  }, undefined);

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t border-zinc-200 bg-[var(--background)]/95 px-4 py-3 backdrop-blur dark:border-zinc-800">
      <form action={(fd) => startTransition(() => action(fd))}>
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="feel" value={feel ?? ""} />

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Feel</span>
          <span className="text-xs text-zinc-400">{feel ? `${feel}/10` : "—"}</span>
        </div>

        <div className="mt-1.5 grid grid-cols-10 gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setFeel(n)}
              className={`h-9 rounded-md text-sm font-semibold transition-colors ${
                feel === n
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        {expanded && (
          <textarea
            name="comment"
            defaultValue={dayLog?.comment ?? ""}
            rows={2}
            placeholder="Overall comment for the day…"
            className="mt-3 w-full rounded-xl border border-zinc-300 bg-transparent p-3 text-base dark:border-zinc-700"
          />
        )}

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex-1 rounded-full border border-zinc-300 py-2 text-sm font-medium dark:border-zinc-700"
          >
            {expanded ? "Hide comment" : dayLog?.comment ? "Edit comment" : "Add comment"}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-full bg-emerald-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save day"}
          </button>
        </div>
      </form>
    </div>
  );
}
