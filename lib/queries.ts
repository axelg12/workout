import "server-only";
import { and, asc, desc, eq, gte, isNotNull, lt } from "drizzle-orm";
import { db } from "./db";
import {
  planDays,
  planExercises,
  exerciseLogs,
  dayLogs,
  type PlanExercise,
  type ExerciseLog,
  type DayLog,
} from "./schema";

export type ExerciseWithLog = PlanExercise & {
  log: ExerciseLog | null;
  lastTime: { date: string; actual: string | null } | null;
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

/** Most recent prior logged actual for an exercise, before `beforeDate`. */
async function getLastTime(
  exerciseName: string,
  beforeDate: string,
): Promise<{ date: string; actual: string | null } | null> {
  const rows = await db
    .select({ date: exerciseLogs.date, actual: exerciseLogs.actual })
    .from(exerciseLogs)
    .where(
      and(
        eq(exerciseLogs.exerciseName, exerciseName),
        lt(exerciseLogs.date, beforeDate),
        isNotNull(exerciseLogs.actual),
      ),
    )
    .orderBy(desc(exerciseLogs.date))
    .limit(1);
  return rows[0] ?? null;
}

/** Load a single day: plan + parsed exercises (each with its log + last-time) + day log. */
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

  const exercises: ExerciseWithLog[] = [];
  for (const ex of exerciseRows) {
    const lastTime = await getLastTime(ex.name, date);
    exercises.push({
      ...ex,
      log: logByExerciseId.get(ex.id) ?? null,
      lastTime,
    });
  }

  const dayLogRows = await db
    .select()
    .from(dayLogs)
    .where(eq(dayLogs.date, date))
    .limit(1);

  return { day, exercises, dayLog: dayLogRows[0] ?? null };
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
