import Link from "next/link";
import { getDay, getPlanDates } from "@/lib/queries";
import { todayISO } from "@/lib/dates";
import { DateStrip } from "@/app/components/DateStrip";
import { WorkoutCard } from "@/app/components/WorkoutCard";
import { DayLogBar } from "@/app/components/DayLogBar";

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const [view, dates] = await Promise.all([getDay(date), getPlanDates()]);

  const idx = dates.indexOf(date);
  const prev = idx > 0 ? dates[idx - 1] : null;
  const next = idx >= 0 && idx < dates.length - 1 ? dates[idx + 1] : null;
  const isToday = date === todayISO();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col pb-40">
      <DateStrip date={date} prev={prev} next={next} isToday={isToday} today={todayISO()} />

      <div className="flex-1 px-4">
        {view ? (
          <WorkoutCard day={view.day} exercises={view.exercises} />
        ) : (
          <div className="mt-16 text-center text-zinc-500">
            <p className="text-lg">No workout planned for this day.</p>
            <Link
              href={`/day/${todayISO()}`}
              className="mt-4 inline-block rounded-full bg-zinc-800 px-5 py-2 text-sm text-white"
            >
              Jump to today
            </Link>
          </div>
        )}
      </div>

      {view && <DayLogBar date={date} dayLog={view.dayLog} />}
    </main>
  );
}
