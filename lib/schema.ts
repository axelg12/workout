import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  date,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// ── PLAN tables (overwritten by the seed; the source of truth is the xlsx) ──

export const planDays = pgTable("plan_days", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(), // canonical YYYY-MM-DD
  dayOfWeek: text("day_of_week"),
  weekLabel: text("week_label"), // "Week 1" (forward-filled)
  monthLabel: text("month_label"), // "Month 1" (sheet name)
  workoutType: text("workout_type"), // Rest | Strength | Hybrid (Double) | Running
  focus: text("focus"),
  plannedRaw: text("planned_raw"), // full original Planned Workout cell
  targetNotes: text("target_notes"),
  position: integer("position").notNull().default(0), // ordering within import
});

export const planExercises = pgTable(
  "plan_exercises",
  {
    id: serial("id").primaryKey(),
    planDayId: integer("plan_day_id")
      .notNull()
      .references(() => planDays.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    name: text("name").notNull(),
    target: text("target"),
    raw: text("raw"),
  },
  (t) => [unique("plan_exercises_day_position").on(t.planDayId, t.position)],
);

// ── LOG tables (the app writes these; NEVER touched by the seed) ──

export const exerciseLogs = pgTable("exercise_logs", {
  id: serial("id").primaryKey(),
  // If a re-import deletes a planned exercise, keep the log (set null) so history survives.
  planExerciseId: integer("plan_exercise_id")
    .unique()
    .references(() => planExercises.id, { onDelete: "set null" }),
  date: date("date").notNull(), // denormalized for fast history queries
  exerciseName: text("exercise_name").notNull(), // denormalized: survives re-import
  actual: text("actual"),
  comment: text("comment"),
  done: boolean("done").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dayLogs = pgTable("day_logs", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  feel: integer("feel"), // 1..10
  comment: text("comment"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlanDay = typeof planDays.$inferSelect;
export type PlanExercise = typeof planExercises.$inferSelect;
export type ExerciseLog = typeof exerciseLogs.$inferSelect;
export type DayLog = typeof dayLogs.$inferSelect;
