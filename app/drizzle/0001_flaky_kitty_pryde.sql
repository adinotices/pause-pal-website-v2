CREATE TYPE "public"."match_status" AS ENUM('proposed', 'approved');--> statement-breakpoint
CREATE TABLE "match_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"signup_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"cohort_id" integer NOT NULL,
	"status" "match_status" DEFAULT 'proposed' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"score" real NOT NULL,
	"explanation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_members" ADD CONSTRAINT "match_members_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_members" ADD CONSTRAINT "match_members_signup_id_signups_id_fk" FOREIGN KEY ("signup_id") REFERENCES "public"."signups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_members_signup_id_idx" ON "match_members" USING btree ("signup_id");