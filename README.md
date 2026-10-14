# Classista Backend

Backend API for Classista, a platform for discovering and booking sports,
wellness, and creative classes.

This service is built with NestJS and TypeScript. Authentication uses Supabase
Auth (registration, login, password security, tokens); NestJS verifies each
Supabase issued token and owns authorization against the app's own Prisma data.
Partner and studio scoped authorization is still to come.

## Tech Stack

- NestJS
- TypeScript
- Node.js
- PostgreSQL (Supabase) and Prisma
- Supabase Auth
- Vitest
- oxlint

## Getting Started

### Prerequisites

- Node.js
- npm

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in real values (never commit `.env`):

| Variable | Purpose | Safe to expose publicly? |
|---|---|---|
| `DATABASE_URL` | Postgres connection string (Supabase, session mode pooler) | No, contains a password |
| `NODE_ENV` | `development` \| `test` \| `production` | Yes |
| `PORT` | Port the HTTP server listens on | Yes |
| `CORS_ORIGIN` | Allowed frontend origin(s) | Yes |
| `SUPABASE_URL` | The Supabase project's API URL, used to verify auth tokens against its public JWKS | Yes, the frontend needs the same value |

### Run Locally

```bash
npm run start:dev
```

The API runs on `http://localhost:3000` by default.

You can override the port with `PORT`:

```bash
PORT=4000 npm run start:dev
```

## Available Scripts

```bash
npm run start        # Start the NestJS app
npm run start:dev    # Start in watch mode
npm run start:debug  # Start in debug watch mode
npm run build        # Compile the project
npm run start:prod   # Run the compiled app from dist/
npm run lint         # Run oxlint
npm run format       # Format source and test files with Prettier
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run test:cov     # Run tests with coverage
npm run test:e2e     # Run end-to-end tests
npm run test:integration  # Run tests against the local test database (see Testing)
```

## Current API

Full interactive docs (Swagger UI) are served at `/api/docs` when the app is running.

```http
GET /                 # Health check style root route
GET /categories        # Public: the full category hierarchy (parents with their subcategories).
                        # No search filter; the frontend filters the result locally.
GET /auth/me           # Requires "Authorization: Bearer <Supabase access token>"
                        # Returns the authenticated user's Classista profile,
                        # creating their Classista User record on first sight,
                        # plus their partner (id, name, status, role) or null, for display only.
                        # Inactive partners are still returned. MVP rule is one partner per
                        # user but the DB doesn't enforce it yet: if there are several,
                        # the oldest membership is returned.

# Partner Class Types. Require a Bearer token and a partner membership; the
# partner is always taken from the membership, never from the request.
GET   /partner/class-types?isActive=true|false   # Active by default; false = archived
POST  /partner/class-types                       # Create (categoryId must be a leaf category)
PATCH /partner/class-types/:id                   # Edit name, categoryId, description (409 if archived)
POST  /partner/class-types/:id/archive           # Archive; idempotent, keeps plans and sessions
```

Design decisions for Class Types are recorded in
[docs/specs/0002-partner-class-types.md](docs/specs/0002-partner-class-types.md).

```http
# Partner Class Plans. Same auth rules as Class Types.
GET   /partner/class-plans    # The partner's plans (dates as YYYY-MM-DD, times as HH:mm)
POST  /partner/class-plans    # Create a plan and generate its sessions in one transaction
```

Plans generate their sessions automatically. Editing, pausing, and cancelling
plans are not built yet. Details: [docs/specs/0003-class-plans.md](docs/specs/0003-class-plans.md).

## Testing

`npm test` runs the unit tests (mocked database, no setup).

`npm run test:integration` runs tests against a throwaway Postgres in Docker,
never the development database:

```bash
docker run -d --name classista-test-db \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=classista_test \
  -p 127.0.0.1:54329:5432 postgres:17.4

TEST_DATABASE_URL=postgresql://test:test@127.0.0.1:54329/classista_test \
  npm run test:integration
```

It only runs against `localhost:54329/classista_test` and never reads
`DATABASE_URL`. Known issues are listed in the spec above.

## Project Structure

```text
src/
  app.controller.ts       Root HTTP controller
  app.module.ts           Root NestJS module
  main.ts                 Application bootstrap, Swagger setup
  auth/                   Supabase token verification, the auth guard, GET /auth/me
  categories/             Public category browsing
  class-types/            Partner Class Type management (list, create, edit, archive)
  class-plans/            Partner Class Plans: create, list, session generation, daily job
  lib/database/           PrismaService, the app's database connection
  config/                 Environment variable validation
  common/filters/         Global exception handling
test/
  app.e2e-spec.ts         End-to-end test suite
  integration/            Real-database tests and the test database safety guard
```

## Roadmap

- Partner and studio authorization (scoping dashboard access to the authenticated partner)
- Partner and venue management
- Class plan editing, pausing, closing, and cancellation (creation and session generation are done)
- Booking and credit management
- SMTP provider for Supabase's transactional email (confirmation, password reset), before real user onboarding

## License

Private project. All rights reserved.
# classista-backend
