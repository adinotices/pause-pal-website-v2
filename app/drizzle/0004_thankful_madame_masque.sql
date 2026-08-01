CREATE INDEX "availability_slots_signup_id_idx" ON "availability_slots" USING btree ("signup_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cohorts_single_open_idx" ON "cohorts" USING btree ("state") WHERE "cohorts"."state" = 'open';--> statement-breakpoint
CREATE INDEX "magic_link_tokens_person_id_idx" ON "magic_link_tokens" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "match_members_match_id_idx" ON "match_members" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_sessions_match_id_idx" ON "match_sessions" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "matches_cohort_id_idx" ON "matches" USING btree ("cohort_id");--> statement-breakpoint
CREATE INDEX "signups_person_id_idx" ON "signups" USING btree ("person_id");