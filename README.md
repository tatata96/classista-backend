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
Creating a Class Plan must reject archived Class Types, but that rule is **not
implemented yet** because Class Plans do not exist yet.

## Project Structure

```text
src/
  app.controller.ts       Root HTTP controller
  app.module.ts           Root NestJS module
  main.ts                 Application bootstrap, Swagger setup
  auth/                   Supabase token verification, the auth guard, GET /auth/me
  categories/             Public category browsing
  class-types/            Partner Class Type management (list, create, edit, archive)
  lib/database/           PrismaService, the app's database connection
  config/                 Environment variable validation
  common/filters/         Global exception handling
test/
  app.e2e-spec.ts         End-to-end test suite
```

## Roadmap

- Partner and studio authorization (scoping dashboard access to the authenticated partner)
- Partner and venue management
- Class plans and session generation (must only accept active Class Types)
- Booking and credit management
- SMTP provider for Supabase's transactional email (confirmation, password reset), before real user onboarding

## License

Private project. All rights reserved.
# classista-backend
