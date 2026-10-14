# 0003. Class Plans

**Date**: 2026-10-14
**Status**: Accepted (first PR in progress: plan creation, listing, and session generation)

## Summary

A Class Plan is a partner's schedule for one Class Type at one Venue: either a single date (one-time) or a weekly pattern (recurring). Plans do not hold bookable dates themselves. They generate Class Sessions, which customers book. This spec covers plan creation and validation, capacity, session generation, pausing, one-time cancellation, and editing.

**Out of scope** (separate specs): customer notifications, credits, refunds, payouts, the 12-hour late-cancellation policy, no-show handling, and the "one spot, one payment" rule. Where a rule below touches a booking outcome (cancelling a class, editing a plan), only the schedule behavior is specified here, never the money side.

## Implementation scope

The first PR builds only **plan creation and session generation** (creation rules, capacity, the rolling window, idempotent generation, the daily job, and the venue and Class Type checks). Plan creation, listing, and session generation are in scope. Editing, pausing, closing, cancellation, and single-session capacity edits are specified below but **deferred to later PRs**. Booking endpoints and the booking-window check are also later. Schema fields needed only by deferred features (override flags, cancellation fields) are added in the PR that builds them.

Related: [0002 Partner Class Types](0002-partner-class-types.md).

## Creating a plan

- A plan is `ONE_TIME` or `RECURRING`. Recurring plans have `weekdays` and a start date, and an **optional** end date (without one, the plan runs open-ended; generation is still limited to the rolling window).
- **Weekdays use ISO numbers:** 1 = Monday through 7 = Sunday (documented in Swagger). Recurring plans require at least one; duplicates are rejected; one-time plans have none.
- **End dates are inclusive:** a plan ending today still generates today's remaining occurrences.
- **The plan's title is derived from the selected Class Type's name at creation.** The request has no title input, and renaming the Class Type later does not change the plan's title.
- The Class Type must be **active**. Archived Class Types are rejected (the follow-up promised in spec 0002; needs a test).
- The partner always comes from the authenticated membership, never from the request. Class Type, Venue, and Instructor must belong to that partner.
- **Creating for today is allowed.**
  - A one-time class must start in the future.
  - A recurring plan starting today skips occurrences whose start time has already passed.
- **Same-day sessions only.** Every session starts and finishes on the same calendar day, for one-time and recurring plans alike.
- All times are interpreted in the **Venue's timezone** (`Venue.timezone`, IANA).
- **MVP supports only `Europe/Istanbul` venues, and clients never send a timezone.**
  - `timezone` is removed from the venue create and update request DTOs. A request that includes it returns 400 through the global validation pipe (`forbidNonWhitelisted`).
  - The backend sets `Europe/Istanbul` itself when a venue is created (`VENUE_TIMEZONE`). Onboarding already did this and is unchanged.
  - `Venue.timezone` stays in the database but is **not exposed** in venue or onboarding API responses (every venue is Istanbul, so clients gain nothing). Session generation reads it from the venue rather than assuming Istanbul, so supporting other regions later needs no generation change.
  - Existing data was checked read-only: both current venues are `Europe/Istanbul`. If a future check finds another timezone, flag it; never silently rewrite it.
  - **Daylight saving handling for other timezones is deferred** until venues outside Turkey are supported.

### Duration

- The backend accepts any duration in **positive whole minutes**. Presets are a frontend convenience only; the backend has no preset list.
- The session must finish **by midnight**: ending exactly at 00:00 is allowed (for example 23:00 plus 60 minutes). Ending after midnight (for example 00:30) is rejected, because sessions are same-day.
- The plan stores `startTime` and `durationMinutes` (there is no `endTime` column, because an end of `00:00` is ambiguous). A session's `endAt` is `startAt` plus the duration, so a session ending at midnight has an `endAt` of 00:00 on the following date. Validate on start time plus duration <= 24:00.

### Capacity

Two fields, both positive whole numbers:

| Field                | Meaning                                                                             |
| -------------------- | ----------------------------------------------------------------------------------- |
| Total class capacity | Maximum participants in the whole class, including bookings made outside Classista. |
| Classista capacity   | Maximum bookings accepted through Classista.                                        |

- Classista capacity cannot exceed total class capacity.
- Both values are stored on the Class Plan and **copied onto each generated Class Session**.
- Mobile display: total capacity reads "Up to 30 participants". Any remaining-seat figure must say explicitly that it is Classista seats (for example "5 Classista spots left").

## Session generation

A recurring plan defines a schedule. It does not create every session up to its end date.

- Sessions are generated within a **rolling 30-day window**. The window is defined on instants: a session qualifies if `now < startAt <= now + 30 × 24 hours`. Generation and the booking check use this same definition. The Venue timezone only determines a session's actual start instant; it does not shift the window.
- Generation runs when a plan is **created or edited**, and a **daily scheduled job** extends the window for active plans.
- A one-time plan immediately creates exactly one session, **even if it starts beyond the 30-day window**. The window applies to recurring generation only.
- **End dates are inclusive**, so the daily job includes plans ending today.
- **Startup catch-up:** the app also runs generation once at startup, in addition to the daily job, so downtime does not leave a gap.
- **Each plan's generation is isolated** (its own transaction), so one failure does not stop the others.
- Plan creation and its first session generation run in **one database transaction**: if generation fails, the plan is not created. The daily job generates in its own per-plan transactions.
- **Paused plans do not generate sessions.**
- Customers can book only sessions starting within the same window (after now, no later than 30 × 24 hours from now), and **the backend enforces it**.
- The daily job uses `@nestjs/schedule`, an approved new dependency (added at implementation time, not yet installed).
- Verification of transaction rollback and duplicate prevention must run against a real test database; mocked Prisma cannot prove them.
- **Generation is idempotent.** It checks which sessions already exist and creates only the missing ones. The existing `@@unique([classPlanId, startAt])` on Class Session is the safety net, so a repeated or concurrent run cannot create duplicates.
- **Why a session was cancelled decides whether generation may bring it back.** The unique key only prevents duplicates; it does not decide this behavior.
  - **Cancelled explicitly** (partner cancels the session or one-time class): it stays cancelled. Generation never recreates or restores it.
  - **Removed by a plan edit** (for example Monday → Tuesday): the session leaves the schedule, but if a later edit makes the plan match that occurrence again (same `startAt`) and the session is still in the future and eligible under the editing rules (more than 24 hours away, no bookings), generation **restores** it instead of creating a duplicate.
  - Restoring reuses the existing row (the unique key forbids a second one).
  - Restoring requires the **same `startAt`**. Example: after Monday 18:00 sessions are removed, changing back to Monday 18:00 restores them; changing to Monday 19:00 leaves the 18:00 rows removed and generates new 19:00 sessions.
- **Cancellation is recorded in four session fields:**
  - `cancelledReason`: free text, the explanation shown to users (for example "Instructor unavailable").
  - `cancelledById`: the authenticated Classista User who performed the cancellation or the plan edit.
  - `cancelledAt`: when it happened.
  - `cancellationSource`: internal enum distinguishing explicit cancellation from removal by a plan edit. This is what generation checks; it never reads the free text.
  - When a session is restored after a plan edit, all four fields are cleared.
  - A full action-history or event table is deferred. Only the latest cancellation is kept on the row.

Example: the job generated Monday Yoga for May 18, May 25, and June 1. The next day it runs again, sees May 25 and June 1 are still in the window, and creates only the one newly in-range date.

## Pausing and reactivating

Pausing is available **only for recurring plans**.

- Pausing stops new bookings on the plan's sessions, keeps existing bookings, and does **not** cancel any session.
- Already-generated sessions stay in the database. Individual sessions must be cancelled separately.
- The partner can reactivate the plan. Reactivation resumes generation within the **current** 30-day window, starting from the reactivation date.
- Sessions for the paused period are **never generated retroactively**.
- Example: paused May 15 with sessions generated through June 14; reactivated August 1. The backend generates the missing sessions for August 1 onward. June and July are not backfilled.

Later, not in this feature: a partner permanently closing a recurring class may want to cancel all its upcoming sessions at once. That is a separate action. Pause never does it.

## Cancelling a one-time class

- The dashboard exposes a **Cancel class** action on the Class Plan page.
- It calls the **same backend cancellation operation** the Schedule page uses for sessions.
- Existing active bookings are cancelled. (The refund itself is defined in the credits spec. Customer notifications are out of scope for this feature.)
- The plan stays in the database and shows a cancelled status **derived from its session**. It is not a stored plan status.
- Completed or already-cancelled sessions cannot be cancelled again.
- Every cancellation records a reason and the actor.

## Editing a plan

Partners may edit a plan at any time. Changes apply to **future sessions** according to a 24-hour editing cutoff. There is **no direct session-time editing**; a session's time changes only as a result of editing its plan, following the cutoff and booking protections. (A single session's capacity can be edited directly; see below.)

The 24-hour cutoff is measured from **each session's scheduled start time**, not from the plan's creation or edit time.

| Session state                                   | Effect of a plan edit       |
| ----------------------------------------------- | --------------------------- |
| Starts within the next 24 hours                 | Not modified.               |
| Starts more than 24 hours away, **no bookings** | Updated automatically.      |
| Has bookings (regardless of start time)         | Keeps its original details. |
| Newly generated                                 | Uses the updated plan.      |

- Booked sessions keep their original details, so their bookings are **never** cancelled or rescheduled by a plan edit.
- Booked sessions also keep both original capacities (total and Classista) when the plan's capacities change.
- **One-time plans:** an edit is **rejected** (409) if it would change a booked session or a session starting within 24 hours. A one-time plan and its session otherwise stay aligned; the only allowed difference is an explicit session capacity override.
- **Capacity overrides are tracked per field.** When a partner edits a session's total or Classista capacity directly, that field is marked as overridden on the session. Later plan edits update the session's other eligible fields but preserve overridden capacity fields.
- **Invariant, always enforced:** total capacity >= Classista capacity >= occupied booking count. If a plan edit would break it on a session because of a preserved override (for example the plan lowers total capacity below a session's overridden Classista capacity), that session keeps **both** of its current capacities (total and Classista) unchanged, while its other eligible fields (time, venue, instructor) still update.
- **Occupied booking count** is the number of bookings with status `BOOKED` or `ATTENDED`. `NO_SHOW`, `CANCELLED`, `LATE_CANCELLED`, `CANCELLED_BY_PARTNER`, and `REMOVED` are excluded. Classista capacity cannot be reduced below it.
- Example: Monday Yoga becomes Tuesday Yoga.
  - Keep Monday sessions that have bookings or start within 24 hours.
  - Cancel the other upcoming Monday sessions.
  - Generate Tuesday sessions within the next 30 days.
- Implementation reading: an edit that keeps a session's weekday (time, capacity, venue, instructor) updates eligible sessions in place; a weekday change cancels the eligible old-weekday sessions and generates new ones, as in the example.

### Editing one session's capacity

A partner may edit the capacity of a single session directly. Session time still changes only through the plan.

- Classista capacity cannot fall below the session's **occupied booking count**.
- Each edited field is recorded as a manual override (see Editing a plan).
- Total capacity cannot fall below Classista capacity.
- The positive-whole-number rule and Classista capacity <= total capacity apply as on plans.
- The partner is taken from the authenticated membership and the session must belong to that partner's plan.

## Listing plans

`GET /partner/class-plans` lists the authenticated partner's plans, so the frontend can show them and prefill a duplicate. It is in the first PR.

## Data model impact

`ClassPlan` and `ClassSession` replace the single `capacity` column with `totalCapacity` and `classistaCapacity`. `ClassPlan` replaces `endTime` with `durationMinutes`. The migration must handle existing rows explicitly: it never invents total capacities and never resets the database. If a table has rows it cannot migrate reliably, the migration fails with a clear message instead of guessing (when written, all three tables were empty). Later PRs add: per-field capacity override flags (total and Classista), and `cancelledById`, `cancelledAt`, and `cancellationSource` beside the existing free-text `cancelledReason` (see Session generation). `cancelledById` references `User`.
