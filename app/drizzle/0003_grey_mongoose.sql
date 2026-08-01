CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"signup_id" integer NOT NULL,
	"rating" smallint NOT NULL,
	"text" text NOT NULL,
	"consent_to_publish" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"publish_display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_signup_id_unique" UNIQUE("signup_id")
);
--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "magic_link_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "sent_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"reference_id" integer NOT NULL,
	"occurrence_date" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_signup_id_signups_id_fk" FOREIGN KEY ("signup_id") REFERENCES "public"."signups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sent_reminders_unique_idx" ON "sent_reminders" USING btree ("kind","reference_id","occurrence_date");