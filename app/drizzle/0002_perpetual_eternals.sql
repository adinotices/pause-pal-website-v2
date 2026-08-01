CREATE TABLE "match_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"day_of_week" smallint NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL,
	"first_occurrence_at" timestamp with time zone NOT NULL,
	"week_count" smallint NOT NULL,
	"google_calendar_event_id" text
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "zoom_meeting_id" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "zoom_join_url" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "match_sessions" ADD CONSTRAINT "match_sessions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;