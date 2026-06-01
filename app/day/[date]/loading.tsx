export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4">
      <div className="h-14 animate-pulse" />
      <div className="mt-2 h-28 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
      <div className="mt-3 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60"
          />
        ))}
      </div>
    </main>
  );
}
