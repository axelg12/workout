import { getExerciseHistory } from "@/lib/queries";
import { formatLong } from "@/lib/dates";
import { BackButton } from "@/app/components/BackButton";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ exerciseName: string }>;
}) {
  const { exerciseName } = await params;
  const name = decodeURIComponent(exerciseName);
  const history = await getExerciseHistory(name);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">
      <BackButton />
      <h1 className="mt-2 text-xl font-bold">{name}</h1>
      <p className="text-sm text-zinc-500">History</p>

      {history.length === 0 ? (
        <p className="mt-8 text-center text-zinc-500">No logged entries yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {history.map((h, i) => (
            <li
              key={i}
              className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="text-sm font-semibold">{formatLong(h.date)}</div>
              {h.actual && (
                <div className="mt-1 whitespace-pre-wrap text-sm">{h.actual}</div>
              )}
              {h.comment && (
                <div className="mt-1.5 whitespace-pre-wrap text-xs text-zinc-500">
                  {h.comment}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
