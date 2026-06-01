"use client";

import { useActionState, startTransition } from "react";
import Link from "next/link";
import type { ExerciseWithLog } from "@/lib/queries";
import { formatShort } from "@/lib/dates";
import { logExercise } from "@/app/actions";

export function ExerciseLogSheet({
  exercise,
  date,
  onClose,
}: {
  exercise: ExerciseWithLog;
  date: string;
  onClose: () => void;
}) {
  const log = exercise.log;

  const [, action, pending] = useActionState(async (_: void, formData: FormData) => {
    await logExercise(formData);
    onClose();
  }, undefined);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal>
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />

      <div className="relative max-h-[88vh] overflow-y-auto rounded-t-3xl bg-[var(--background)] p-5 pb-8 shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />

        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold leading-snug">{exercise.name}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-zinc-400">
            ×
          </button>
        </div>
        {exercise.target && (
          <p className="mb-3 text-sm text-zinc-500">Target: {exercise.target}</p>
        )}

        {exercise.lastTime?.actual && (
          <div className="mb-4 rounded-xl bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-800">
            <span className="font-medium text-zinc-500">
              Last time ({formatShort(exercise.lastTime.date)}):
            </span>
            <span className="mt-0.5 block whitespace-pre-wrap">
              {exercise.lastTime.actual}
            </span>
          </div>
        )}

        <form
          action={(fd) => startTransition(() => action(fd))}
          className="space-y-4"
        >
          <input type="hidden" name="planExerciseId" value={exercise.id} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="exerciseName" value={exercise.name} />

          <div>
            <label className="mb-1 block text-sm font-medium">What I did</label>
            <textarea
              name="actual"
              defaultValue={log?.actual ?? ""}
              rows={4}
              placeholder="e.g. 12×60kg, 12×60kg, 10×65kg"
              className="w-full rounded-xl border border-zinc-300 bg-transparent p-3 text-base dark:border-zinc-700"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Comment</label>
            <textarea
              name="comment"
              defaultValue={log?.comment ?? ""}
              rows={2}
              placeholder="How it felt, form notes, niggles…"
              className="w-full rounded-xl border border-zinc-300 bg-transparent p-3 text-base dark:border-zinc-700"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="done"
              defaultChecked={log?.done ?? false}
              className="h-5 w-5"
            />
            Mark as done
          </label>

          <div className="flex items-center justify-between pt-1">
            <Link
              href={`/history/${encodeURIComponent(exercise.name)}`}
              className="text-sm font-medium text-blue-500"
            >
              View history →
            </Link>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-emerald-600 px-6 py-2.5 font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
