// Pure date helpers (safe on both server and client). Plan dates are canonical
// "YYYY-MM-DD" strings; we avoid timezone surprises by formatting from parts.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Today's local date as "YYYY-MM-DD". */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse "YYYY-MM-DD" into a local Date (noon, to dodge DST edges). */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/** "Wed, 28 May" */
export function formatShort(iso: string): string {
  const d = parseISO(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "28 May" — compact, for chart axes and labels. */
export function formatDay(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Wednesday, 28 May 2026" */
export function formatLong(iso: string): string {
  const d = parseISO(iso);
  const full = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  ][d.getDay()];
  return `${full}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Pick the plan date equal to `target`, else the chronologically closest one. */
export function nearestDate(dates: string[], target: string): string | null {
  if (dates.length === 0) return null;
  if (dates.includes(target)) return target;
  const t = parseISO(target).getTime();
  let best = dates[0];
  let bestDiff = Math.abs(parseISO(dates[0]).getTime() - t);
  for (const d of dates) {
    const diff = Math.abs(parseISO(d).getTime() - t);
    if (diff < bestDiff) {
      best = d;
      bestDiff = diff;
    }
  }
  return best;
}
