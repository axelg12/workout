CREATE TABLE "body_weights" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"weight_kg" double precision NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "body_weights_date_unique" UNIQUE("date")
);
