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
