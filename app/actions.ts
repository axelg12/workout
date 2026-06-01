"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { exerciseLogs, dayLogs } from "@/lib/schema";

/** Upsert the per-exercise log (keyed by plan_exercise_id). */
export async function logExercise(formData: FormData) {
  const planExerciseId = Number(formData.get("planExerciseId"));
  const date = String(formData.get("date") ?? "");
  const exerciseName = String(formData.get("exerciseName") ?? "");
  const actual = String(formData.get("actual") ?? "").trim() || null;
  const comment = String(formData.get("comment") ?? "").trim() || null;
  const done = formData.get("done") === "on";

  if (!planExerciseId || !date || !exerciseName) return;

  await db
    .insert(exerciseLogs)
    .values({ planExerciseId, date, exerciseName, actual, comment, done })
    .onConflictDoUpdate({
      target: exerciseLogs.planExerciseId,
      set: { actual, comment, done, date, exerciseName, updatedAt: new Date() },
    });

  revalidatePath(`/day/${date}`);
}

/** Upsert the per-day log (keyed by date): Feel + overall comment. */
export async function logDay(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const feelRaw = formData.get("feel");
  const feel = feelRaw ? Number(feelRaw) : null;
  const comment = String(formData.get("comment") ?? "").trim() || null;

  if (!date) return;

  await db
    .insert(dayLogs)
    .values({ date, feel, comment })
    .onConflictDoUpdate({
      target: dayLogs.date,
      set: { feel, comment, updatedAt: new Date() },
    });

  revalidatePath(`/day/${date}`);
}

/** Clear a logged exercise. */
export async function clearExercise(formData: FormData) {
  const planExerciseId = Number(formData.get("planExerciseId"));
  const date = String(formData.get("date") ?? "");
  if (!planExerciseId) return;
  await db.delete(exerciseLogs).where(eq(exerciseLogs.planExerciseId, planExerciseId));
  if (date) revalidatePath(`/day/${date}`);
}
