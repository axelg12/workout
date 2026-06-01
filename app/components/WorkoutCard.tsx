import type { PlanDay } from "@/lib/schema";
import type { ExerciseWithLog } from "@/lib/queries";
import { ExerciseRow } from "./ExerciseRow";

const TYPE_STYLES: Record<string, string> = {
  Strength: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  Running: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  "Hybrid (Double)": "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  Rest: "bg-zinc-500/15 text-zinc-500",
};

export function WorkoutCard({
  day,
  exercises,
}: {
  day: PlanDay;
  exercises: ExerciseWithLog[];
}) {
  const typeStyle = TYPE_STYLES[day.workoutType ?? ""] ?? "bg-zinc-500/15 text-zinc-500";

  return (
    <section className="mt-3">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          {day.workoutType && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${typeStyle}`}>
              {day.workoutType}
            </span>
          )}
          <span className="text-xs text-zinc-400">
            {[day.weekLabel, day.monthLabel].filter(Boolean).join(" · ")}
          </span>
        </div>
        {day.focus && (
          <h1 className="mt-2 text-lg font-bold leading-snug">{day.focus}</h1>
        )}
        {day.targetNotes && (
          <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            {day.targetNotes}
          </p>
        )}
      </div>

      {exercises.length > 0 ? (
        <ul className="mt-3 space-y-2.5">
          {exercises.map((ex) => (
            <ExerciseRow key={ex.id} exercise={ex} date={day.date} />
          ))}
        </ul>
      ) : (
        day.plannedRaw && (
          <p className="mt-4 whitespace-pre-wrap px-1 text-sm text-zinc-500">
            {day.plannedRaw}
          </p>
        )
      )}
    </section>
  );
}
