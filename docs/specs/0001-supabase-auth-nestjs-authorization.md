# 0001. Adopt Supabase Auth for authentication and NestJS for authorization

**Date**: 2026-09-22
**Status**: Accepted

## Summary

Classista uses Supabase Auth (a hosted service that handles registration, login, and password security) to authenticate users, and NestJS to verify the tokens Supabase issues and to enforce who can access what. Supabase never becomes the source of truth for Classista's own data; Prisma and the existing `User` table stay in charge of bookings, partner memberships, and every other business record. This decision is final; what still needs deciding, and will be worked through with the engineer one checkpoint at a time, is how a Supabase identity connects to a Prisma `User` row, and how the NestJS side verifies and guards requests.

## Context

Classista needs user registration, login, and session handling, plus a way for the NestJS API to know who is calling it and what they are allowed to do. The team is an experienced frontend engineer learning backend and NestJS for the first time, wants to understand each piece rather than receive a finished implementation, and has a hard constraint: stay on free tiers, no paid auth or security services.

The project already runs its database on Supabase Postgres through Prisma, with an existing `User` model carrying its own role (`CUSTOMER` or `ADMIN`) and its own relationships to bookings and partner memberships. Building password storage, token issuance, refresh rotation, and password reset inside NestJS would duplicate a service already available on the same platform, for no clear benefit.

## Requirements

**User stories**:
- As a new visitor, I want to register with email and password through Supabase so that Classista never stores my password itself.
- As a returning user, I want to log in through Supabase and use the resulting access token so that NestJS recognizes me on every request.
- As an authenticated user, I want `GET /auth/me` to return my Classista profile so the frontend can show who is signed in.
- As the platform, I want a newly registered user to default to the `CUSTOMER` role with no partner memberships, so nobody can grant themselves elevated access at signup.
- As a new visitor, I want Supabase's confirmation and password reset emails to actually reach my inbox, not just work in testing, so registration and password recovery work for real users.

**Acceptance criteria**:
- **AC-1**: A request to `GET /auth/me` with no token returns 401.
- **AC-2**: A request to `GET /auth/me` with an invalid token (malformed, or a bad signature) returns 401.
- **AC-3**: A request to `GET /auth/me` with an expired token returns 401.
- **AC-4**: A request to `GET /auth/me` with a valid Supabase access token returns the correct Classista user, resolved through the identity mapping, never trusted from a client supplied id.
- **AC-5**: No registration path can set a new user's role to `ADMIN`, or attach a `PartnerMembership`; every new user starts as `CUSTOMER` with no memberships.
- **AC-6**: The identity mapping between a Supabase user and a Classista `User` never creates a duplicate Classista user for the same Supabase identity across repeated logins.
- **AC-7**: No Supabase secret (the service role key, or a shared JWT signing secret if that verification method is chosen) is ever exposed to the frontend or committed to the repository. A public JWKS verification key, if that method is chosen instead, is not a secret and is exempt from this rule.
- **AC-8**: Supabase's confirmation and password reset emails are delivered through a free tier SMTP provider, not Supabase's default testing only sender, so they reach real users.
- **AC-9**: A new Supabase signup whose email matches an existing Classista `User` is never linked to that user automatically on the email match alone.

## Options considered

The engineer's brief already named the deciding forces (the free tier constraint, and Postgres already running on Supabase), so this section records them for completeness rather than reopening the choice.

### Option 1: Supabase Auth for authentication, NestJS for authorization (chosen)

Supabase owns registration, login, password security, and token issuance. NestJS verifies each token and enforces authorization against the existing Prisma data.

**Pros**:
- No password storage, hashing, or reset flow to build or secure.
- Stays on Supabase's free tier, and reuses infrastructure already in place.

**Cons**:
- Adds a runtime dependency on Supabase for signup and login. Ongoing token verification does not need to contact Supabase on every request; whether it needs to contact Supabase at all depends on the project's JWT signing configuration, decided at Checkpoint 3 or 4.

### Option 2: Roll a custom email and password system inside NestJS

Store password hashes in Prisma, issue and verify JWTs (JSON Web Tokens, a signed, self contained way of proving who a request is from) directly in NestJS.

**Pros**:
- Full control, nothing external to configure.

**Cons**:
- Reimplements a problem that is easy to get wrong in ways that matter (password hashing, token expiry, refresh rotation, email verification, password reset), with no offsetting benefit here.

### Option 3: A separate hosted auth provider not already in the stack (for example Auth0, Clerk, or Firebase Auth)

**Pros**:
- Mature, well documented products.

**Cons**:
- A second vendor and a second set of credentials to manage, on top of a database already on Supabase; most add cost or limits the free tier constraint would immediately bump into.

## Decision

**Chosen option**: Option 1: Supabase Auth for authentication, NestJS for authorization.

Supabase Auth is responsible for registration, login, password security, tokens, and sessions. NestJS verifies each Supabase issued token and owns every authorization decision, using the existing Prisma `User`, `Partner`, and `PartnerMembership` models. Supabase specific token verification logic lives in one dedicated NestJS service, a small isolation for readability, not a provider abstraction layer; the engineer confirmed no provider swap is planned, so nothing further is built for that case.

## Rationale

The free tier constraint rules out a second paid vendor (Option 3), and Postgres is already on Supabase, so Supabase Auth adds no new infrastructure to operate. Reinventing password based authentication (Option 2) is a well known source of security bugs (password hashing, token rotation, and password reset each carry real risk if built from scratch) for a problem Supabase already solves. Keeping Supabase specific verification logic in one service, rather than spreading it through the codebase, costs little and keeps the rest of NestJS focused on Prisma backed business logic.

> ⚠️ Premise note (resolved at Checkpoint 2): this spec originally documented a decision with an undecided prerequisite, how a Supabase identity maps to the existing Prisma `User` model. That prerequisite is now decided and applied; see `## Feature design` below.

## Feature design

**Data model sketch**:
The existing Prisma `User` model already has `id` (uuid, primary key), `name`, `email` (unique, optional), `phone` (unique, optional), `role` (`CUSTOMER` by default, or `ADMIN`), plus relations to `PartnerMembership`, `Booking`, and `BookingEvent`.

Checkpoint 2 decision (confirmed with the engineer, and applied in migration `20260922130341_add_supabase_id_to_user`): add a single nullable, unique column, `supabaseId String? @unique @db.Uuid`, on `User`. Nullable because a `User` created by an admin before that person ever signs up has no Supabase identity yet. The `User` row itself is created lazily: the first authenticated request carrying a new Supabase identity creates it (an atomic `upsert` keyed on `supabaseId`, so concurrent requests for the same new identity cannot create two rows, satisfying **AC-6**). `name` is populated from Supabase's signup metadata (`user_metadata`) when the frontend sends it, falling back to a value derived from the email address otherwise, so creation never fails on a missing name. If the new identity's email matches an existing `User` row (for example a partner employee added manually before they ever signed up), the existing `email String? @unique` constraint makes a second row with that email impossible; that collision is caught and rejected with a clear conflict, never auto linked, satisfying **AC-9**. No separate mapping table and no webhook based creation: both were considered and rejected as unneeded complexity, since there is exactly one identity provider and JIT creation needs no new public endpoint.

Checkpoint 4/5 refinement: the find-or-create call lives inside `SupabaseAuthGuard` itself (not the `/auth/me` controller), so **any** route protected by that guard resolves or creates the Classista `User`, not only `/auth/me`. The guard attaches the resolved `User` (only `id`, `name`, `email`, `role`) to `request.user`, matching the common pattern of a guard/strategy attaching the authenticated principal to the request. This was a deliberate fix during Checkpoint 5: the first version tied JIT creation to the `/auth/me` endpoint specifically, which would have silently skipped creation for any other endpoint someone protected with the same guard later.

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/auth/me` | GET | none | id, name, email, role | bearer | 401 |

`GET /auth/me` takes its identity from the bearer token (a Supabase access token in the Authorization header), not from any input. It returns the authenticated user's own profile; the fields above are the initial scope. Partner memberships are added to the response later, only if and when a caller needs them, without turning this endpoint into partner authorization (see Security model, and the separate future decision in Follow up). The 401 covers three distinct causes: no token, an invalid token, or an expired token.

**Value sourcing**:
| Action | Value produced | Source |
|---|---|---|
| `GET /auth/me` | the authenticated user's Classista profile | derived from the verified token's subject claim, resolved to a Prisma `User` row through `supabaseId` (decided and applied at Checkpoint 2) |
| `GET /auth/me` | 401 response | the token failing signature, issuer, or expiry checks in the token verification service |

**Key invariants**:
- Every `User.id` referenced by `Booking`, `PartnerMembership`, and `BookingEvent` stays independent of the Supabase identifier.
- A Supabase identity maps to at most one Classista `User` row; repeated logins never create duplicates.
- A newly created Classista `User` always starts with role `CUSTOMER` and no `PartnerMembership` rows.

**Security model**:
- `GET /auth/me` requires a valid Supabase access token; missing, invalid, or expired tokens all return 401.
- Registration can never set role to `ADMIN` or create a `PartnerMembership`; both stay admin assigned only, per the project's existing manual onboarding rule.
- Partner and studio level authorization (scoping dashboard data to the authenticated partner, checking `PartnerMembership`) is explicitly out of scope for this spec; it is its own later decision (see Follow up).

**Configuration required**:
- `SUPABASE_URL`: the project's Supabase API URL, used by NestJS to verify tokens. Safe to expose publicly; the frontend needs the same value.
- The way NestJS verifies a token depends on the Supabase project's JWT signing configuration, a Checkpoint 3 or 4 decision. If the project signs with an asymmetric algorithm, verification uses Supabase's JWKS (JSON Web Key Set) endpoint, a set of public verification keys; these are not secret and can be fetched and cached openly. If the project signs with a shared symmetric secret instead, that secret is a real backend only credential, never shipped to the frontend or committed to the repository.
- An SMTP provider for Supabase Auth's transactional email (signup confirmation, password reset), configured in the Supabase dashboard, not in NestJS. Supabase's own built in email sender is rate limited and meant for testing, not real users; a free tier SMTP provider (for example Resend or Brevo both offer a free tier) is picked at Checkpoint 3. Its credentials live only in the Supabase dashboard, never in this repo.
- The frontend additionally needs `SUPABASE_ANON_KEY` (public, safe to expose) for its own direct Supabase client. The Supabase service role key must never leave the Supabase dashboard or a trusted backend context.

**Critical test scenarios**:
- Happy path: a request with a valid token returns the correct Classista user, verifies **AC-4**.
- Failure case: a request with an expired token returns 401, verifies **AC-3**.
- Auth/permission: registration cannot set `ADMIN` or attach a `PartnerMembership`, verifies **AC-5**.

## Build plan

1. ~~Checkpoint 2: design and apply the identity mapping schema change~~ — done: `supabaseId` added to `User` via migration `20260922130341_add_supabase_id_to_user`, satisfies **AC-6**, **AC-9** (the JIT creation logic and the email-collision guard are still to be written in NestJS code, at Checkpoint 5).
2. ~~Checkpoint 3: configure the Supabase project and NestJS environment variables~~ — done: confirmed JWKS (asymmetric signing keys, `ECC P-256`) is the project's signing method, `SUPABASE_URL` added to `.env`/`.env.example` and validated at startup, satisfies **AC-7**. SMTP (**AC-8**) is deliberately postponed, tracked below, not blocking the rest of the build.
3. ~~Checkpoint 4: build the Supabase token verification service and the NestJS auth guard~~ — done: `SupabaseAuthService` ([src/auth/supabase-auth.service.ts](../../src/auth/supabase-auth.service.ts)) verifies signature, issuer, audience, and expiry via `jose` + JWKS; `SupabaseAuthGuard` ([src/auth/guards/supabase-auth.guard.ts](../../src/auth/guards/supabase-auth.guard.ts)) rejects missing/invalid/expired tokens with 401, satisfies **AC-1**, **AC-2**, **AC-3** (confirmed by hand with curl: both the no-token and garbage-token cases return the expected 401 shape).
4. ~~Checkpoint 5: implement `GET /auth/me`~~ — done: `AuthController`/`AuthService` ([src/auth/auth.controller.ts](../../src/auth/auth.controller.ts), [src/auth/auth.service.ts](../../src/auth/auth.service.ts)) resolve the verified token to a Classista `User` via the upsert from Checkpoint 2, returning only `id`, `name`, `email`, `role`, satisfies **AC-4**, **AC-5**, **AC-6**, **AC-9**. Verified so far with no token and an invalid token (both correctly 401); the valid-token path needs a real Supabase-issued token to exercise, at Checkpoint 6.
5. Checkpoint 6: write tests for AC-1 through AC-9, and update Swagger and the README with the new endpoint and required environment variables.

## Consequences

**Positive**:
- No password storage, hashing, or reset flow to build or secure inside NestJS.
- Stays on free tiers; no new paid vendor introduced.
- Business data (bookings, memberships) keeps a stable internal identifier, untouched by anything Supabase does to its own user records.

**Negative / tradeoffs**:
- NestJS depends on Supabase for signup and login; a Supabase outage always affects those. Whether it also affects token verification on an already authenticated request depends on the project's JWT signing configuration, decided at Checkpoint 3 or 4, not on contacting Supabase for every request as a rule.
- Two systems now hold part of a user's identity (Supabase owns credentials, Prisma owns the profile and business relationships); the mapping between them, once decided at Checkpoint 2, becomes a permanent invariant that needs care to change later.

**Neutral**:
- The frontend talks to two backends: Supabase directly for signup, login, and password reset, and NestJS for everything else.
- Existing endpoints such as categories are unaffected; this feature only adds new auth surface.

## Follow-up

- [x] Checkpoint 2: identity mapping decided and applied — `supabaseId` added to `User` via migration `20260922130341_add_supabase_id_to_user`.
- [ ] Checkpoint 3 or 4: decide the exact token verification mechanism (a JWKS endpoint with caching, versus a shared JWT secret), based on the Supabase project's current signing configuration.
- [ ] Checkpoint 3: pick a free tier SMTP provider for Supabase Auth's transactional email (confirmation, password reset) and configure it in the Supabase dashboard; Supabase's built in sender is testing only and not meant for real users.
- [ ] Partner and studio authorization (scoping dashboard routes to the authenticated partner, guarding `PartnerMembership`) is a separate, later decision; do not fold it into this spec.
- [ ] Several Prisma community skills are installed in this repo (`.agents/skills/prisma-client-api/`, `.agents/skills/prisma-cli/`, and others) but are not yet referenced in `CLAUDE.md`; worth a pointer once the Checkpoint 2 schema work begins.
