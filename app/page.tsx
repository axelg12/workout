import Link from "next/link";
import { getUpcoming, getPlanDates, getBodyWeights } from "@/lib/queries";
import { todayISO, formatLong, formatShort, nearestDate } from "@/lib/dates";
import { rollingAverage } from "@/lib/analysis";
import { BodyWeightCard } from "./components/BodyWeightCard";
import { LineChart } from "./components/LineChart";

// "Today" must be computed per request, never baked at build time.
export const dynamic = "force-dynamic";

const TYPE_STYLES: Record<string, string> = {
  Strength: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  Running: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  "Hybrid (Double)": "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  Rest: "bg-zinc-500/15 text-zinc-500",
};

function typeStyle(t: string | null) {
  return TYPE_STYLES[t ?? ""] ?? "bg-zinc-500/15 text-zinc-500";
}

export default async function Home() {
  const today = todayISO();
  const [upcoming, weights] = await Promise.all([
    getUpcoming(today, 8),
    getBodyWeights(),
  ]);

  const latestWeight = weights[weights.length - 1] ?? null;
  const todayWeight = weights.find((w) => w.date === today) ?? null;
  const weightAvgSeries = rollingAverage(
    weights.map((w) => ({ date: w.date, value: w.weightKg })),
  );
  const weekAvgKg =
    weightAvgSeries.length > 0
      ? Math.round(weightAvgSeries[weightAvgSeries.length - 1].value * 10) / 10
      : null;
  // Small trend: the last ~30 entries, smoothed line + daily dots.
  const recentWeights = weights.slice(-30);
  const weightChart = (
    <>
      {recentWeights.length >= 2 && (
        <div className="mt-2">
          <LineChart
            points={recentWeights.map((w) => ({ x: w.date, y: w.weightKg }))}
            avgPoints={
              recentWeights.length >= 3
                ? rollingAverage(
                    recentWeights.map((w) => ({ date: w.date, value: w.weightKg })),
                  ).map((p) => ({ x: p.date, y: Math.round(p.value * 10) / 10 }))
                : undefined
            }
            unit="kg"
            height={110}
          />
        </div>
      )}
    </>
  );

  // Plan finished (no days today or later): point at the most recent day.
  if (upcoming.length === 0) {
    const dates = await getPlanDates();
    const last = nearestDate(dates, today);
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10 text-center">
        <h1 className="text-2xl font-bold">Workout</h1>
        <p className="mt-4 text-zinc-500">Your plan has no more upcoming days.</p>
        {last && (
          <Link
            href={`/day/${last}`}
            className="mt-6 inline-block rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white"
          >
            Go to {formatShort(last)}
          </Link>
        )}
      </main>
    );
  }

  const primary = upcoming[0];
  const isPrimaryToday = primary.date === today;
  const rest = upcoming.slice(1, 6);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <header className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workout</h1>
          <p className="text-sm text-zinc-500">{formatLong(today)}</p>
        </div>
        <Link
          href="/progress"
          className="rounded-full border border-zinc-300 px-3.5 py-1.5 text-sm font-medium text-emerald-600 dark:border-zinc-700 dark:text-emerald-400"
        >
          Progress →
        </Link>
      </header>

      {/* Today's (or next) workout — the primary action */}
      <Link
        href={`/day/${primary.date}`}
        className="block rounded-3xl border border-zinc-200 bg-white p-5 active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            {isPrimaryToday ? "Today" : `Next · ${formatShort(primary.date)}`}
          </span>
          {primary.workoutType && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${typeStyle(primary.workoutType)}`}
            >
              {primary.workoutType}
            </span>
          )}
        </div>
        <h2 className="mt-2 text-xl font-bold leading-snug">
          {primary.focus ?? "Workout"}
        </h2>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          Open workout →
        </span>
      </Link>

      {/* Coming up */}
      {rest.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Coming up
          </h3>
          <ul className="space-y-2">
            {rest.map((d) => (
              <li key={d.date}>
                <Link
                  href={`/day/${d.date}`}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span className="w-14 shrink-0 text-sm font-semibold text-zinc-500">
                    {formatShort(d.date).split(",")[0]}
                    <span className="block text-xs font-normal text-zinc-400">
                      {formatShort(d.date).split(", ")[1]}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {d.focus ?? d.workoutType ?? "—"}
                  </span>
                  {d.workoutType && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeStyle(d.workoutType)}`}
                    >
                      {d.workoutType}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Body weight quick entry + trend */}
      <div className="mt-6">
        <BodyWeightCard
          date={today}
          todayWeightKg={todayWeight?.weightKg ?? null}
          latest={
            latestWeight
              ? { date: latestWeight.date, weightKg: latestWeight.weightKg }
              : null
          }
          weekAvgKg={weekAvgKg}
        >
          {weightChart}
        </BodyWeightCard>
      </div>
    </main>
  );
}
