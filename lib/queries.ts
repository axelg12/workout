import "server-only";
import { and, asc, desc, eq, gte, isNotNull } from "drizzle-orm";
import { db } from "./db";
import {
  planDays,
  planExercises,
  exerciseLogs,
  dayLogs,
  bodyWeights,
  type PlanExercise,
  type ExerciseLog,
  type DayLog,
  type BodyWeight,
} from "./schema";
import {
  analyzeHistory,
  canonicalName,
  insightFor,
  type ExerciseInsight,
} from "./analysis";

export type ExerciseWithLog = PlanExercise & {
  log: ExerciseLog | null;
  lastTime: { date: string; actual: string | null } | null;
  insight: ExerciseInsight | null;
};

export type DayView = {
  day: typeof planDays.$inferSelect;
  exercises: ExerciseWithLog[];
  dayLog: DayLog | null;
} | null;

export type UpcomingDay = {
  date: string;
  dayOfWeek: string | null;
  workoutType: string | null;
  focus: string | null;
  weekLabel: string | null;
  monthLabel: string | null;
};

/** The next `limit` planned days from `fromDate` (inclusive), ascending. For the home view. */
export async function getUpcoming(
  fromDate: string,
  limit: number,
): Promise<UpcomingDay[]> {
  return db
    .select({
      date: planDays.date,
      dayOfWeek: planDays.dayOfWeek,
      workoutType: planDays.workoutType,
      focus: planDays.focus,
      weekLabel: planDays.weekLabel,
      monthLabel: planDays.monthLabel,
    })
    .from(planDays)
    .where(gte(planDays.date, fromDate))
    .orderBy(asc(planDays.date))
    .limit(limit);
}

/** All planned dates, ascending. Used for navigation and the "nearest day" fallback. */
export async function getPlanDates(): Promise<string[]> {
  const rows = await db
    .select({ date: planDays.date })
    .from(planDays)
    .orderBy(asc(planDays.date));
  return rows.map((r) => r.date);
}

/** All logged actuals, ascending by date. One cheap query; grouped by canonical name in JS. */
export type StrengthLogRow = {
  date: string;
  exerciseName: string;
  actual: string | null;
};

export async function getAllStrengthLogs(): Promise<StrengthLogRow[]> {
  return db
    .select({
      date: exerciseLogs.date,
      exerciseName: exerciseLogs.exerciseName,
      actual: exerciseLogs.actual,
    })
    .from(exerciseLogs)
    .where(isNotNull(exerciseLogs.actual))
    .orderBy(asc(exerciseLogs.date));
}

function groupByCanonical(rows: StrengthLogRow[]): Map<string, StrengthLogRow[]> {
  const groups = new Map<string, StrengthLogRow[]>();
  for (const r of rows) {
    const key = canonicalName(r.exerciseName);
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }
  return groups;
}

/** Load a single day: plan + parsed exercises (each with its log + last-time + insight) + day log. */
export async function getDay(date: string): Promise<DayView> {
  const dayRows = await db
    .select()
    .from(planDays)
    .where(eq(planDays.date, date))
    .limit(1);
  const day = dayRows[0];
  if (!day) return null;

  const exerciseRows = await db
    .select()
    .from(planExercises)
    .where(eq(planExercises.planDayId, day.id))
    .orderBy(asc(planExercises.position));

  const logRows = await db
    .select()
    .from(exerciseLogs)
    .where(eq(exerciseLogs.date, date));
  const logByExerciseId = new Map<number, ExerciseLog>();
  for (const log of logRows) {
    if (log.planExerciseId != null) logByExerciseId.set(log.planExerciseId, log);
  }

  // One query for all logged history (~dozens of rows), alias-aware so
  // "Squats" and "Squats (Heels slightly elevated)" share one lineage.
  const historyByName = groupByCanonical(await getAllStrengthLogs());

  const exercises: ExerciseWithLog[] = [];
  for (const ex of exerciseRows) {
    const history = historyByName.get(canonicalName(ex.name)) ?? [];
    const prior = history.filter((h) => h.date < date);
    const last = prior[prior.length - 1];
    const sessions = analyzeHistory(history.filter((h) => h.date <= date));
    exercises.push({
      ...ex,
      log: logByExerciseId.get(ex.id) ?? null,
      lastTime: last ? { date: last.date, actual: last.actual } : null,
      insight: insightFor(sessions, date),
    });
  }

  const dayLogRows = await db
    .select()
    .from(dayLogs)
    .where(eq(dayLogs.date, date))
    .limit(1);

  return { day, exercises, dayLog: dayLogRows[0] ?? null };
}

/** All body-weight entries, ascending by date. */
export async function getBodyWeights(): Promise<BodyWeight[]> {
  return db.select().from(bodyWeights).orderBy(asc(bodyWeights.date));
}

/** Per-canonical-exercise session stats for the progress page, most-logged first. */
export async function getProgressByExercise(): Promise<
  { name: string; sessions: ReturnType<typeof analyzeHistory> }[]
> {
  const groups = groupByCanonical(await getAllStrengthLogs());
  return [...groups.entries()]
    .map(([name, rows]) => ({ name, sessions: analyzeHistory(rows) }))
    .filter(({ sessions }) => sessions.filter((s) => s.topWeightKg !== null).length >= 2)
    .sort((a, b) => b.sessions.length - a.sessions.length);
}

/** Full history for an exercise (most recent first). */
export async function getExerciseHistory(
  exerciseName: string,
): Promise<{ date: string; actual: string | null; comment: string | null }[]> {
  return db
    .select({
      date: exerciseLogs.date,
      actual: exerciseLogs.actual,
      comment: exerciseLogs.comment,
    })
    .from(exerciseLogs)
    .where(
      and(
        eq(exerciseLogs.exerciseName, exerciseName),
        isNotNull(exerciseLogs.actual),
      ),
    )
    .orderBy(desc(exerciseLogs.date));
}
