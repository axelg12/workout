"use client";

import { useActionState, startTransition } from "react";
import { logBodyWeight } from "@/app/actions";

/**
 * Quick body-weight entry for the home page. The trend chart is rendered
 * server-side by the page and passed as children so the SVG ships no JS.
 */
export function BodyWeightCard({
  date,
  todayWeightKg,
  latest,
  weekAvgKg,
  children,
}: {
  date: string; // today, YYYY-MM-DD
  todayWeightKg: number | null;
  latest: { date: string; weightKg: number } | null;
  weekAvgKg: number | null;
  children?: React.ReactNode;
}) {
  const [, action, pending] = useActionState(
    async (_: void, formData: FormData) => {
      await logBodyWeight(formData);
    },
    undefined,
  );

  const delta =
    latest && weekAvgKg !== null
      ? Math.round((latest.weightKg - weekAvgKg) * 10) / 10
      : null;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Weight</h3>
        {latest && (
          <span className="text-xs text-zinc-400">
            {latest.weightKg}kg
            {delta !== null && delta !== 0 && (
              <span className="ml-1.5">
                {delta > 0 ? "+" : ""}
                {delta} vs 7-day avg
              </span>
            )}
          </span>
        )}
      </div>

      {children}

      <form
        action={(fd) => startTransition(() => action(fd))}
        className="mt-3 flex items-center gap-2"
      >
        <input type="hidden" name="date" value={date} />
        <input
          key={todayWeightKg ?? "empty"}
          type="text"
          inputMode="decimal"
          name="weightKg"
          defaultValue={todayWeightKg ?? ""}
          placeholder="Today's weight (kg)"
          className="min-w-0 flex-1 rounded-full border border-zinc-300 bg-transparent px-4 py-2 text-sm dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : todayWeightKg !== null ? "Update" : "Save"}
        </button>
      </form>
    </section>
  );
}
