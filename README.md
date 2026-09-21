# Classista Backend

Backend API for Classista, a platform for discovering and booking sports,
wellness, and creative classes.

This service is built with NestJS and TypeScript. The repository is currently in
initial setup, with database, authentication, and product modules still to come.

## Tech Stack

- NestJS
- TypeScript
- Node.js
- Vitest
- oxlint
- PostgreSQL and Prisma planned

## Getting Started

### Prerequisites

- Node.js
- npm

### Installation

```bash
npm install
```

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

The starter API currently exposes:

```http
GET /
```

Response:

```text
Hello World!
```

## Project Structure

```text
src/
  app.controller.ts       Root HTTP controller
  app.controller.spec.ts  Unit test for the root controller
  app.module.ts           Root NestJS module
  app.service.ts          Root application service
  main.ts                 Application bootstrap
test/
  app.e2e-spec.ts         End-to-end test suite
```

## Prisma Schema Notes

Quick reminders from building the first database schema:

- **`@` = field-level attribute.** For example, `@id` marks a primary key and `@unique` makes one field unique.
- **`@@` = model-level attribute.** Use `@@unique([userId, partnerId])` when a *combination* must be unique. Use `@@index([partnerId])` to create an index that can speed up lookups; it **does not prevent duplicates**. `@@index` uses two `@` symbols even for a single field.
- **Foreign key vs. relation field:** `classTypeId` is a real column in `ClassPlan`. `classType ClassType @relation(fields: [classTypeId], references: [id])` describes how that column references `ClassType.id` and lets Prisma access the related record.
- **Reverse relation:** `classPlans ClassPlan[]` in `ClassType` tells Prisma that one class type has many plans. Neither `classType` nor `classPlans` creates an extra database column; the foreign key is `ClassPlan.classTypeId`.

```prisma
model PartnerMembership {
  userId    String @db.Uuid
  partnerId String @db.Uuid

  @@unique([userId, partnerId]) // A user can join a given partner only once.
}

model ClassSession {
  classPlanId String   @db.Uuid
  startAt     DateTime @db.Timestamptz(3)

  @@unique([classPlanId, startAt]) // No duplicate session at the same time for one plan.
  @@index([startAt])              // Speeds up queries by session start time.
}
```

These snippets highlight attributes only; see `prisma/schema.prisma` for the complete models and relations.

## Roadmap

- Database configuration
- Prisma schema and migrations
- Authentication and authorization
- Partner and venue management
- Class plans and session generation
- Booking and credit management
- API validation, error handling, and documentation

## License

Private project. All rights reserved.
# classista-backend
