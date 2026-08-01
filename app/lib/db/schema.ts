import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  integer,
  smallint,
  real,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// --- Enums -----------------------------------------------------------------

export const cohortStateEnum = pgEnum("cohort_state", [
  "draft",
  "open",
  "closed",
  "matching",
  "matched",
  "scheduled",
  "running",
  "complete",
]);

export const signupStatusEnum = pgEnum("signup_status", [
  "submitted",
  "withdrawn",
  "matched",
]);

export const sessionLengthEnum = pgEnum("session_length_minutes", [
  "5",
  "10",
  "15",
  "20",
  "30",
  "30_plus",
]);

export const experienceLevelEnum = pgEnum("experience_level", [
  "new",
  "some_experience",
  "experienced",
]);

export const matchStatusEnum = pgEnum("match_status", ["proposed", "approved"]);

// --- Core tables -------------------------------------------------------------

/**
 * A cohort is one 4-week run of the program. `number` matches the informal
 * "Cohort 8" naming used historically in commit messages / the old Formbricks
 * form links.
 */
export const cohorts = pgTable("cohorts", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull().unique(),
  state: cohortStateEnum("state").notNull().default("draft"),
  signupOpensAt: timestamp("signup_opens_at", { withTimezone: true }),
  signupDeadlineAt: timestamp("signup_deadline_at", { withTimezone: true }),
  startsOn: text("starts_on"), // ISO date (YYYY-MM-DD), cohort's local "day one"
  endsOn: text("ends_on"), // ISO date (YYYY-MM-DD)
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A person, deduplicated by email across cohorts. */
export const people = pgTable(
  "people",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    firstName: text("first_name").notNull(),
    // IANA timezone, e.g. "America/New_York". Never store a fixed UTC
    // offset here -- offsets drift across DST, timezone names don't.
    timezone: text("timezone").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("people_email_idx").on(table.email)],
);

/** One person's application to one cohort. */
export const signups = pgTable(
  "signups",
  {
    id: serial("id").primaryKey(),
    cohortId: integer("cohort_id")
      .notNull()
      .references(() => cohorts.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    status: signupStatusEnum("status").notNull().default("submitted"),
    agreedToCommitmentAt: timestamp("agreed_to_commitment_at", {
      withTimezone: true,
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("signups_cohort_person_idx").on(
      table.cohortId,
      table.personId,
    ),
  ],
);

/**
 * A single weekly recurring availability window, always expressed in the
 * signup's local time (person.timezone at the time of submission).
 * dayOfWeek: 0 = Sunday .. 6 = Saturday, matching JS Date#getDay().
 * startMinute/endMinute: minutes since local midnight, [0, 1440).
 */
export const availabilitySlots = pgTable("availability_slots", {
  id: serial("id").primaryKey(),
  signupId: integer("signup_id")
    .notNull()
    .references(() => signups.id, { onDelete: "cascade" }),
  dayOfWeek: smallint("day_of_week").notNull(),
  startMinute: smallint("start_minute").notNull(),
  endMinute: smallint("end_minute").notNull(),
});

/** Matching + program preferences for a single signup. */
export const preferences = pgTable("preferences", {
  id: serial("id").primaryKey(),
  signupId: integer("signup_id")
    .notNull()
    .references(() => signups.id, { onDelete: "cascade" })
    .unique(),
  sessionsPerWeek: smallint("sessions_per_week").notNull(),
  sessionLength: sessionLengthEnum("session_length").notNull(),
  ownGenderIdentity: text("own_gender_identity"),
  partnerGenderPreference: text("partner_gender_preference"), // free text; no fixed enum, see note in form
  partnerGenderIsHardRequirement: boolean(
    "partner_gender_is_hard_requirement",
  )
    .notNull()
    .default(false),
  experienceLevel: experienceLevelEnum("experience_level").notNull(),
  notes: text("notes"),
});

/**
 * A proposed or approved meditation pairing (usually 2 people, occasionally
 * 3 when the cohort has an odd number of matchable signups -- see
 * lib/matching). `pinned` matches are left untouched when the admin
 * regenerates proposals for a cohort. `score` and `explanation` are a
 * snapshot from whenever the match was last (re)computed by the solver;
 * they aren't recalculated after a manual pin/swap.
 */
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  cohortId: integer("cohort_id")
    .notNull()
    .references(() => cohorts.id, { onDelete: "cascade" }),
  status: matchStatusEnum("status").notNull().default("proposed"),
  pinned: boolean("pinned").notNull().default(false),
  score: real("score").notNull(),
  explanation: text("explanation").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Phase 3 (scheduling): one Zoom meeting per match, reused across all of
  // that match's weekly sessions. Null until "send calendar invites" runs.
  zoomMeetingId: text("zoom_meeting_id"),
  zoomJoinUrl: text("zoom_join_url"),
  // Timestamp of the last time "send calendar invites" ran for this match
  // -- NOT proof that it fully succeeded (Zoom/Calendar may have been
  // unconfigured, or partially failed). Whether a match still needs work
  // is computed fresh from its actual state each time; see
  // lib/db/scheduling-queries.ts#isFullyProcessed.
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
});

/** A signup should belong to at most one match at a time -- enforced by the
 * unique index below, not just application logic. */
export const matchMembers = pgTable(
  "match_members",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    signupId: integer("signup_id")
      .notNull()
      .references(() => signups.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("match_members_signup_id_idx").on(table.signupId)],
);

/**
 * One recurring weekly meeting time for a match (a match with
 * sessionsPerWeek > 1 has more than one of these). `dayOfWeek` and
 * `startMinute`/`endMinute` are in the *canonical* shared timeline used by
 * the matching engine (see lib/matching/availability.ts), not any one
 * person's local time -- render in each member's own timezone at display
 * time. `firstOccurrenceAt` is the real UTC instant of the first
 * occurrence; later occurrences are that plus 7/14/21... days, and
 * `weekCount` says how many occurrences the program runs for.
 */
export const matchSessions = pgTable("match_sessions", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  dayOfWeek: smallint("day_of_week").notNull(),
  startMinute: smallint("start_minute").notNull(),
  endMinute: smallint("end_minute").notNull(),
  firstOccurrenceAt: timestamp("first_occurrence_at", { withTimezone: true }).notNull(),
  weekCount: smallint("week_count").notNull(),
  googleCalendarEventId: text("google_calendar_event_id"),
});

/**
 * A single-use magic-link sign-in token for the participant dashboard.
 * Only the SHA-256 hash of the token is stored -- same principle as a
 * password hash -- so a DB read alone can't be used to sign in as anyone;
 * the raw token only ever exists in the emailed link.
 */
export const magicLinkTokens = pgTable("magic_link_tokens", {
  id: serial("id").primaryKey(),
  personId: integer("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * End-of-program feedback for one signup (a person can give feedback once
 * per cohort they participated in). `publishDisplayName` is admin-curated
 * (e.g. "D. Kim" rather than a full name) and only shown once `published`
 * is set -- consenting to publish doesn't publish it immediately, an admin
 * still reviews it first.
 */
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  signupId: integer("signup_id")
    .notNull()
    .references(() => signups.id, { onDelete: "cascade" })
    .unique(),
  rating: smallint("rating").notNull(),
  text: text("text").notNull(),
  consentToPublish: boolean("consent_to_publish").notNull().default(false),
  published: boolean("published").notNull().default(false),
  publishDisplayName: text("publish_display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Records that a given reminder email actually went out, keyed so a cron
 * route that runs more than once (retries, overlapping schedules) can't
 * send the same reminder twice. `kind` + `referenceId` + `occurrenceDate`
 * must be unique together -- see lib/db/reminder-queries.ts, which relies
 * on a DB conflict (not an application-level check) to make sends
 * race-safe.
 */
export const sentReminders = pgTable(
  "sent_reminders",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(),
    referenceId: integer("reference_id").notNull(),
    occurrenceDate: text("occurrence_date").notNull(), // ISO date (YYYY-MM-DD)
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sent_reminders_unique_idx").on(
      table.kind,
      table.referenceId,
      table.occurrenceDate,
    ),
  ],
);

// --- Relations ---------------------------------------------------------------

export const cohortsRelations = relations(cohorts, ({ many }) => ({
  signups: many(signups),
  matches: many(matches),
}));

export const peopleRelations = relations(people, ({ many }) => ({
  signups: many(signups),
  magicLinkTokens: many(magicLinkTokens),
}));

export const magicLinkTokensRelations = relations(magicLinkTokens, ({ one }) => ({
  person: one(people, {
    fields: [magicLinkTokens.personId],
    references: [people.id],
  }),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  signup: one(signups, {
    fields: [feedback.signupId],
    references: [signups.id],
  }),
}));

export const signupsRelations = relations(signups, ({ one, many }) => ({
  cohort: one(cohorts, {
    fields: [signups.cohortId],
    references: [cohorts.id],
  }),
  person: one(people, {
    fields: [signups.personId],
    references: [people.id],
  }),
  availabilitySlots: many(availabilitySlots),
  preferences: one(preferences, {
    fields: [signups.id],
    references: [preferences.signupId],
  }),
  matchMembership: one(matchMembers, {
    fields: [signups.id],
    references: [matchMembers.signupId],
  }),
  feedback: one(feedback, {
    fields: [signups.id],
    references: [feedback.signupId],
  }),
}));

export const availabilitySlotsRelations = relations(
  availabilitySlots,
  ({ one }) => ({
    signup: one(signups, {
      fields: [availabilitySlots.signupId],
      references: [signups.id],
    }),
  }),
);

export const preferencesRelations = relations(preferences, ({ one }) => ({
  signup: one(signups, {
    fields: [preferences.signupId],
    references: [signups.id],
  }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  cohort: one(cohorts, {
    fields: [matches.cohortId],
    references: [cohorts.id],
  }),
  members: many(matchMembers),
  sessions: many(matchSessions),
}));

export const matchMembersRelations = relations(matchMembers, ({ one }) => ({
  match: one(matches, {
    fields: [matchMembers.matchId],
    references: [matches.id],
  }),
  signup: one(signups, {
    fields: [matchMembers.signupId],
    references: [signups.id],
  }),
}));

export const matchSessionsRelations = relations(matchSessions, ({ one }) => ({
  match: one(matches, {
    fields: [matchSessions.matchId],
    references: [matches.id],
  }),
}));
