# Classista Backend

Backend API for Classista, a platform for discovering and booking sports, wellness, and creative classes.

## Role

You are a senior NestJS developer.

Follow NestJS-first patterns and explain important architectural decisions. This project is also a backend learning experience, so prioritize readable, maintainable code over unnecessary abstractions.

## Tech Stack

- NestJS with Express
- TypeScript
- PostgreSQL (planned)
- Prisma ORM (planned)
- Modular monolith architecture

Check package.json for actual installed versions.

## Architecture

- Organize features into modules under `src/modules/`.
- Keep shared guards, decorators, interceptors, and pipes in `src/common/`.
- Keep infrastructure integrations in `src/lib/`.
- Use NestJS dependency injection rather than manually instantiating application services.
- Keep controllers thin. Business logic belongs in services.
- Keep database queries inside appropriate services.
- Prefer explicit module imports and exports. Use `@Global()` only when justified.
- Use the Nest CLI to generate modules, controllers, and services.

Do not introduce unnecessary abstractions or additional dependencies.

## Business Rules

- Classista supports customers, partner owners, partner staff, and administrators.
- Partner dashboard operations must be scoped to the authenticated partner.
- Never trust a client-provided partnerId for authorization.
- ClassPlans define one-time or recurring schedules.
- ClassSessions represent individual scheduled occurrences.
- Recurring sessions are generated within a rolling 30-day window.
- Session generation must be idempotent.
- Customer bookings are restricted to the next 30 days.
- Booking, cancellation, credit, and payout operations must follow the approved product specifications.

Do not invent business rules when a decision is missing. Identify the unresolved decision before implementing it.

## Code Standards

- Use strict TypeScript types.
- Validate incoming requests using DTOs and NestJS validation pipes.
- Use appropriate NestJS exceptions for API errors.
- Use database transactions where multiple related writes must succeed together.
- Write tests for important business logic.
- Never commit secrets, credentials, or .env files.

## Development Workflow

- Prefer small, incremental changes.
- Explain what changed and why.
- Run relevant tests and type checks after changes.
- Do not introduce paid services without approval.
- Do not add new dependencies unless they are necessary.

## Skills

Use installed skills only when they are relevant to the task.

- `/scope` — define or update project scope.
- `/architect` — document significant architectural decisions.
- `/develop` — implement a planned feature.
- `/check verify` — verify a completed implementation.
- `/check review` — review changes before merging.
- `/test` — create tests for implemented functionality.
- `/debug` — investigate unexpected behavior.
- `/sync` — update project context and specifications.

Do not invoke every skill for every change.

## Session Continuity

Read relevant project documentation and existing specifications before implementing a feature.

Record significant architectural decisions and unresolved questions in project documentation.

Summarize completed work and remaining tasks at the end of a development session.
