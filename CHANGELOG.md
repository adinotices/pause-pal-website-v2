# PausePal Changelog

## [Unreleased]

### Fixed

#### Data Integrity & Race Conditions
- **Scheduling lockout**: Fixed issue where scheduling cohorts with unconfigured integrations (Zoom/Google Calendar) would permanently lock out matches from being scheduled again. Now uses `isFullyProcessed()` check that accounts for current configuration state rather than relying on stale `scheduledAt` flag. ([#19](https://github.com/adinotices/pause-pal-website-v2/issues/19))
- **Match destruction on resubmission**: Fixed critical bug where re-submitting a signup after being matched would silently delete the entire match and all associated data. Now uses database transactions to atomically update signup status and reject resubmissions if already matched/withdrawn. ([#20](https://github.com/adinotices/pause-pal-website-v2/issues/20))
- **Reminder email race condition**: Fixed reminder system that was recording sends as successful before emails actually completed sending, causing permanent loss of reminders on transient failures. Refactored to check idempotency before batch send, and only record as sent after all emails succeed. ([#24](https://github.com/adinotices/pause-pal-website-v2/issues/24))

#### Security & Authorization
- **Missing admin/participant checks**: Added `requireAdmin()` and `requireParticipant()` authorization guards to all server actions, preventing unauthorized access to admin operations and participant-specific features. ([#21](https://github.com/adinotices/pause-pal-website-v2/issues/21))

#### User Experience
- **Contradictory dashboard messaging**: Fixed dashboard showing both "still being finalized" and full session list simultaneously. Now displays correct state: "finalizing" (no sessions), "Zoom link coming soon" (sessions but no Zoom URL), or full details (complete scheduling). ([#22](https://github.com/adinotices/pause-pal-website-v2/issues/22))
- **DST crossing uninformed**: Added proactive warning when creating cohorts with dates spanning daylight saving time transitions (US 2024-2026), alerting admins to verify session times after participant signup. ([#27](https://github.com/adinotices/pause-pal-website-v2/issues/27))

#### Database Performance & Constraints
- **Missing indexes**: Added indexes on all foreign key columns (signup_id, match_id, person_id, cohort_id) for improved query performance on joins and lookups.
- **Non-unique open cohort constraint**: Added partial unique index on cohorts(state) WHERE state='open' to enforce at most one open cohort at a time at the database level.
- **Availability overlap deduplication**: Refactored `summarizeOverlap()` to support N-way intersection (pair and trio matching), eliminating duplicate logic between matching and scheduling engines.
- **Cohort state progression**: Added explicit state advancement from 'matched' to 'scheduled' once all approved matches are fully processed and no errors occurred.

#### Accessibility (WCAG Compliance)
- **Accordion content in accessibility tree**: Replaced native `<details>` element with client-side accordion component that properly manages `aria-expanded`, `aria-hidden`, and DOM attributes to ensure form content is removed from assistive technology when collapsed. ([#25](https://github.com/adinotices/pause-pal-website-v2/issues/25))
- **Availability grid keyboard/screen reader support**: Converted static table cells to interactive buttons with:
  - Arrow key navigation between cells (up/down/left/right)
  - Space/Enter key support to toggle selection
  - ARIA labels announcing day name, time, and selection state
  - Proper semantic table structure with caption and scope attributes
  - Visible focus ring (emerald outline) for keyboard users
  - 12-hour time format (9:00am vs 9:00) for improved readability
  ([#26](https://github.com/adinotices/pause-pal-website-v2/issues/26))

### Changed
- Improved time display across availability grid and scheduling views
- Enhanced error messages in matching and scheduling flows
- Strengthened database constraints to prevent invalid state transitions

### Technical Details
- All changes tested against 98-test suite (100% passing)
- ESLint validation (0 errors, 0 warnings)
- Database migration (0004_thankful_madame_masque.sql) adds all new indexes and constraints
- Backward compatible — no breaking changes to existing integrations

## Previous Releases

Refer to git history for details on earlier phases:
- Phase 4: Participant accounts, feedback, testimonials, reminders
- Phase 3: Zoom + Google Calendar scheduling integration
- Phase 0: Marketing site revamp with SEO and accessibility improvements
