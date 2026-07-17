"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { exerciseLogs, dayLogs, bodyWeights } from "@/lib/schema";

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

/** Upsert the body-weight entry (keyed by date). Accepts "82,5" and "82.5". */
export async function logBodyWeight(formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const raw = String(formData.get("weightKg") ?? "").trim().replace(",", ".");
  const weightKg = Number(raw);

  if (!date || !Number.isFinite(weightKg) || weightKg <= 0) return;

  await db
    .insert(bodyWeights)
    .values({ date, weightKg })
    .onConflictDoUpdate({
      target: bodyWeights.date,
      set: { weightKg, updatedAt: new Date() },
    });

  revalidatePath("/");
}

/** Clear a logged exercise. */
export async function clearExercise(formData: FormData) {
  const planExerciseId = Number(formData.get("planExerciseId"));
  const date = String(formData.get("date") ?? "");
  if (!planExerciseId) return;
  await db.delete(exerciseLogs).where(eq(exerciseLogs.planExerciseId, planExerciseId));
  if (date) revalidatePath(`/day/${date}`);
}
