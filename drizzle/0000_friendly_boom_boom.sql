CREATE TABLE "day_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"feel" integer,
	"comment" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_logs_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "exercise_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_exercise_id" integer,
	"date" date NOT NULL,
	"exercise_name" text NOT NULL,
	"actual" text,
	"comment" text,
	"done" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_logs_plan_exercise_id_unique" UNIQUE("plan_exercise_id")
);
--> statement-breakpoint
CREATE TABLE "plan_days" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"day_of_week" text,
	"week_label" text,
	"month_label" text,
	"workout_type" text,
	"focus" text,
	"planned_raw" text,
	"target_notes" text,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "plan_days_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "plan_exercises" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_day_id" integer NOT NULL,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"target" text,
	"raw" text,
	CONSTRAINT "plan_exercises_day_position" UNIQUE("plan_day_id","position")
);
--> statement-breakpoint
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_plan_exercise_id_plan_exercises_id_fk" FOREIGN KEY ("plan_exercise_id") REFERENCES "public"."plan_exercises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_exercises" ADD CONSTRAINT "plan_exercises_plan_day_id_plan_days_id_fk" FOREIGN KEY ("plan_day_id") REFERENCES "public"."plan_days"("id") ON DELETE cascade ON UPDATE no action;