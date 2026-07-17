import Link from "next/link";
import { getProgressByExercise, getBodyWeights } from "@/lib/queries";
import { rollingAverage } from "@/lib/analysis";
import { formatShort } from "@/lib/dates";
import { LineChart } from "@/app/components/LineChart";
import { BackButton } from "@/app/components/BackButton";

// Charts must reflect the latest logs on every visit.
export const dynamic = "force-dynamic";

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string }>;
}) {
  const { exercise } = await searchParams;
  const [progress, weights] = await Promise.all([
    getProgressByExercise(),
    getBodyWeights(),
  ]);

  const selected =
    progress.find((p) => p.name === exercise) ?? progress[0] ?? null;

  const sessions =
    selected?.sessions.filter((s) => s.topWeightKg !== null) ?? [];
  const topPoints = sessions.map((s) => ({ x: s.date, y: s.topWeightKg! }));
  const volumePoints = sessions
    .filter((s) => s.volumeKg > 0)
    .map((s) => ({ x: s.date, y: Math.round(s.volumeKg) }));
  const prDates = sessions.filter((s) => s.isPr).map((s) => s.date);
  const recent = [...sessions].reverse().slice(0, 4);

  const weightPoints = weights.map((w) => ({ x: w.date, y: w.weightKg }));
  const weightAvg = rollingAverage(
    weights.map((w) => ({ date: w.date, value: w.weightKg })),
  ).map((p) => ({ x: p.date, y: Math.round(p.value * 10) / 10 }));

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">
      <BackButton />
      <h1 className="mt-2 text-xl font-bold">Progress</h1>
      <p className="text-sm text-zinc-500">Strength &amp; body weight</p>

      {progress.length === 0 ? (
        <p className="mt-8 text-center text-zinc-500">
          Not enough logged sessions yet — charts appear after an exercise has
          two logged days.
        </p>
      ) : (
        <>
          {/* Exercise picker */}
          <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {progress.map((p) => (
              <Link
                key={p.name}
                href={`/progress?exercise=${encodeURIComponent(p.name)}`}
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium ${
                  p.name === selected?.name
                    ? "bg-emerald-600 text-white"
                    : "border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                }`}
              >
                {p.name}
              </Link>
            ))}
          </div>

          {/* Top-set weight */}
          <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Top set</h2>
              <span className="text-xs text-zinc-400">
                heaviest working set, kg
              </span>
            </div>
            <div className="mt-2">
              <LineChart points={topPoints} prDates={prDates} unit="kg" />
            </div>
            {prDates.length > 0 && (
              <p className="mt-1 text-xs text-zinc-400">
                <span
                  aria-hidden
                  className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-600"
                />
                new personal record
              </p>
            )}
          </section>

          {/* Session volume */}
          <section className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Session volume</h2>
              <span className="text-xs text-zinc-400">
                reps × weight, warmups excluded
              </span>
            </div>
            <div className="mt-2">
              <LineChart points={volumePoints} />
            </div>
          </section>

          {/* Recent sessions */}
          {recent.length > 0 && (
            <section className="mt-3">
              <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Recent sessions
              </h3>
              <ul className="space-y-2">
                {recent.map((s) => (
                  <li
                    key={s.date}
                    className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        {formatShort(s.date)}
                      </span>
                      <span className="text-xs text-zinc-400">
                        top {s.topWeightKg}kg
                        {s.isPr && (
                          <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            PR
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-zinc-500">
                      {s.sets
                        .filter((x) => !x.isWarmup)
                        .map((x) => `${x.reps}×${x.weightKg}`)
                        .join("  ")}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Body weight */}
      {weightPoints.length > 0 && (
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Body weight</h2>
            <span className="text-xs text-zinc-400">kg</span>
          </div>
          <div className="mt-2">
            <LineChart
              points={weightPoints}
              avgPoints={weightPoints.length >= 3 ? weightAvg : undefined}
              unit="kg"
              height={130}
            />
          </div>
          {weightPoints.length >= 3 && (
            <p className="mt-1 text-xs text-zinc-400">
              <span
                aria-hidden
                className="mr-1 inline-block h-0.5 w-3 translate-y-[-2px] rounded bg-emerald-600"
              />
              7-day average
              <span
                aria-hidden
                className="ml-3 mr-1 inline-block h-1.5 w-1.5 rounded-full bg-zinc-400"
              />
              daily
            </p>
          )}
        </section>
      )}
    </main>
  );
}
