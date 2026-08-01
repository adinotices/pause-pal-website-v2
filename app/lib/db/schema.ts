import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  integer,
  smallint,
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

// --- Relations ---------------------------------------------------------------

export const cohortsRelations = relations(cohorts, ({ many }) => ({
  signups: many(signups),
}));

export const peopleRelations = relations(people, ({ many }) => ({
  signups: many(signups),
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
