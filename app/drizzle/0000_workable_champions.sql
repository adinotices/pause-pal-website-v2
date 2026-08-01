CREATE TYPE "public"."cohort_state" AS ENUM('draft', 'open', 'closed', 'matching', 'matched', 'scheduled', 'running', 'complete');--> statement-breakpoint
CREATE TYPE "public"."experience_level" AS ENUM('new', 'some_experience', 'experienced');--> statement-breakpoint
CREATE TYPE "public"."session_length_minutes" AS ENUM('5', '10', '15', '20', '30', '30_plus');--> statement-breakpoint
CREATE TYPE "public"."signup_status" AS ENUM('submitted', 'withdrawn', 'matched');--> statement-breakpoint
CREATE TABLE "availability_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"signup_id" integer NOT NULL,
	"day_of_week" smallint NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cohorts" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"state" "cohort_state" DEFAULT 'draft' NOT NULL,
	"signup_opens_at" timestamp with time zone,
	"signup_deadline_at" timestamp with time zone,
	"starts_on" text,
	"ends_on" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cohorts_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"timezone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"signup_id" integer NOT NULL,
	"sessions_per_week" smallint NOT NULL,
	"session_length" "session_length_minutes" NOT NULL,
	"own_gender_identity" text,
	"partner_gender_preference" text,
	"partner_gender_is_hard_requirement" boolean DEFAULT false NOT NULL,
	"experience_level" "experience_level" NOT NULL,
	"notes" text,
	CONSTRAINT "preferences_signup_id_unique" UNIQUE("signup_id")
);
--> statement-breakpoint
CREATE TABLE "signups" (
	"id" serial PRIMARY KEY NOT NULL,
	"cohort_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"status" "signup_status" DEFAULT 'submitted' NOT NULL,
	"agreed_to_commitment_at" timestamp with time zone,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_signup_id_signups_id_fk" FOREIGN KEY ("signup_id") REFERENCES "public"."signups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_signup_id_signups_id_fk" FOREIGN KEY ("signup_id") REFERENCES "public"."signups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signups" ADD CONSTRAINT "signups_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signups" ADD CONSTRAINT "signups_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "people_email_idx" ON "people" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "signups_cohort_person_idx" ON "signups" USING btree ("cohort_id","person_id");