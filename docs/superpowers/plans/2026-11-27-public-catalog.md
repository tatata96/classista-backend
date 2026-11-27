# Public Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visitors without an account can browse classes and businesses, and see upcoming class dates.

**Architecture:** One new read-only `CatalogModule` in `src/catalog/` with no guards. Visibility rules are Prisma `where` builders in one file, used by every query. Each response comes from an explicit `select`.

**Tech Stack:** NestJS 12, Prisma 7, class-validator, Vitest, supertest. No new dependencies, no schema change.

**Spec:** [docs/specs/0004-public-catalog.md](../../specs/0004-public-catalog.md)

## Global Constraints

- Routes: `GET /catalog/classes`, `GET /catalog/classes/:id`, `GET /catalog/businesses`, `GET /catalog/businesses/:id`. No guards.
- Visible session: status `SCHEDULED`; `now < startAt <= now + 30 days`; plan `ACTIVE`; venue `ACTIVE`; Class Type active; partner `ACTIVE`.
- A class is visible with at least one visible session; a business with at least one visible class.
- Paging: `page` default 1; `limit` default 20, maximum 50; response `{ items, total, page, limit }`. Order: name, then id.
- Never returned: `classistaCapacity`, `bookingCutoffMinutes`, statuses, venue timezone, member or user data.
- Unknown and hidden ids return the same 404. A non-UUID id returns 400.
- Imports use the `.js` extension. Booleans use an `is`/`has` prefix.
- Generate modules, controllers, and services with the Nest CLI.
- **Work one task at a time. After each task, explain the changes, run the checks, and stop. The user reviews, commits, and pushes. Never commit or push.**

## Before starting

- Branch `feat/public-catalog` (already created). Leave `.vscode/settings.json` out of commits.
- Integration tests need Docker running and the test database (`docker start classista-test-db`; first-time command is in `test/integration/test-database.ts`).
- In every integration command below, `$DB` means `TEST_DATABASE_URL=postgresql://test:test@127.0.0.1:54329/classista_test`.

## Review Focus

- A huge page number (`page=100000000000`) returns 400, not a 500 (Task 2).
- A page past the end returns `items: []` with the correct `total` (Task 1).
- A class with several sessions, some hidden, appears once and shows only the visible ones (Tasks 1 and 3).
- An unsupported query parameter (`?search=yoga`) returns 400, not a silently unfiltered list (Task 2).
- A visitor sending an expired or garbage token still gets 200 (Task 2).

---

### Task 1: Which classes can a visitor see

**Files:**
- Create: `src/catalog/catalog.module.ts`, `src/catalog/catalog-classes.service.ts` and `.spec.ts` (Nest CLI)
- Create: `src/catalog/catalog-visibility.ts`, `src/catalog/catalog-selects.ts`, `src/catalog/dto/catalog-class-response.dto.ts`
- Create: `src/class-plans/booking-window.ts`
- Modify: `src/class-plans/session-generation/session-generation.service.ts` (use the shared constant)
- Test: `test/integration/catalog-seed.ts`, `test/integration/catalog.integration-spec.ts`

**Interfaces:**
- Produces:
  - `BOOKING_WINDOW_MS: number`
  - `visibleSessionWhere(now: Date): Prisma.ClassSessionWhereInput`
  - `visibleClassWhere(now: Date): Prisma.ClassTypeWhereInput` (only sets `classPlans`, so it is safe to spread next to `id` or `partnerId`)
  - `CLASS_LIST_SELECT` and `toClassListItem(row): CatalogClassListItemDto` (database `partner` becomes `business`)
  - `CatalogClassListItemDto { id; name; description: string | null; category: { id; name }; business: { id; name } }`
  - `CatalogClassPageDto { items: CatalogClassListItemDto[]; total: number; page: number; limit: number }`
  - `CatalogClassesService.findPage(page: number, limit: number, now?: Date): Promise<CatalogClassPageDto>`
  - `seedOffer(prisma, options?: { name?: string; startAt?: Date }): Promise<{ partner, category, classType, venue, plan, session }>`: one fully visible class. Unique partner and category per call. `startAt` defaults to `2026-12-02T09:00:00.000Z`.

- [ ] **Step 1: Generate the files**

```bash
npx nest g module catalog
npx nest g service catalog/catalog-classes --flat
```

Check that `CatalogModule` is in `app.module.ts`, then add `imports: [PrismaModule]` to it.

- [ ] **Step 2: Write the failing integration tests** (setup copied from `class-sessions.integration-spec.ts`)

```ts
const NOW = new Date('2026-12-01T09:00:00.000Z');
const ids = async () => (await service.findPage(1, 20, NOW)).items.map((c) => c.id);

it('lists a visible class with exactly the public fields', async () => {
  const { classType, category, partner } = await seedOffer(prisma);
  expect(await service.findPage(1, 20, NOW)).toEqual({
    total: 1, page: 1, limit: 20,
    items: [{
      id: classType.id, name: classType.name, description: classType.description,
      category: { id: category.id, name: category.name },
      business: { id: partner.id, name: partner.name },
    }],
  });
});

// One row per rule. Each changes one thing on a visible offer.
it.each([
  ['the session is cancelled', session status 'CANCELLED'],
  ['the session is completed', session status 'COMPLETED'],
  ['the session starts exactly now', startAt NOW],
  ['the session starts after the window', startAt '2026-12-31T09:00:00.001Z'],
  ['the plan is paused', plan status 'PAUSED'],
  ['the venue is archived', venue status 'ARCHIVED'],
  ['the class type is archived', classType isActive false],
  ['the partner is inactive', partner status 'INACTIVE'],
])('hides a class when %s', ...)   // expect(await ids()).toEqual([])

it('includes a session exactly at the end of the window');   // '2026-12-31T09:00:00.000Z' → listed
it('lists a class once when it has several sessions');       // 2 visible + 1 cancelled → ids() has length 1, total 1
it('orders by name and pages');                              // names 'C','A','B', limit 2: page 1 → A,B; page 2 → C; total 3
it('returns no items past the last page with the true total'); // 1 offer, page 5 → items [], total 1
```

- [ ] **Step 3: Run and confirm failure**

Run: `$DB npm run test:integration -- catalog`
Expected: FAIL (`findPage` does not exist).

- [ ] **Step 4: Implement**

Move `WINDOW_MS` into `booking-window.ts` as `BOOKING_WINDOW_MS`. Write the two `where` builders, the select and mapper, the DTOs (with `@ApiProperty`), and `findPage` (`count` and `findMany` with the same `where`, in `Promise.all`; `orderBy: [{ name: 'asc' }, { id: 'asc' }]`).

- [ ] **Step 5: Fill in the generated unit spec**

Mock `classType.count` and `classType.findMany`. One test: page 3 with limit 10 queries `skip: 20, take: 10`.

- [ ] **Step 6: Verify**

Run: `$DB npm run test:integration && npm test && npm run lint && npm run build`
Expected: all pass, including the existing session generation tests.

- [ ] **Step 7: Stop for review.** Suggested message: `feat: add catalog visibility rules and public class listing service`

---

### Task 2: `GET /catalog/classes`

**Files:**
- Create: `src/catalog/catalog-classes.controller.ts` and `.spec.ts` (Nest CLI)
- Create: `src/catalog/dto/catalog-page-query.dto.ts` and `.spec.ts`
- Test: `test/catalog.e2e-spec.ts`

**Interfaces:**
- Consumes: `CatalogClassesService.findPage`
- Produces: `CatalogPageQueryDto { page: number = 1; limit: number = 20 }`

- [ ] **Step 1: Generate:** `npx nest g controller catalog/catalog-classes --flat`

- [ ] **Step 2: Write the failing tests**

DTO spec (style of `find-class-sessions-query.dto.spec.ts`):
- `{}` is valid and gives `page 1`, `limit 20`; `{ page: '2', limit: '50' }` gives numbers `2` and `50`.
- Rejected: `page` of `'0'`, `'-1'`, `'1.5'`, `'abc'`, `''`, `'100000000000'`; `limit` of `'0'`, `'51'`, `'abc'`.

Controller spec: `findAll({ page: 2, limit: 10 })` calls `findPage(2, 10)`.

E2E spec: import `ConfigModule.forRoot({ isGlobal: true })` and `CatalogModule`, apply `configureApp`, override `PrismaService` with a fake whose `classType.count` and `findMany` return empty results (as in `venues.e2e-spec.ts`).
- no token → 200, body `{ items: [], total: 0, page: 1, limit: 20 }`
- `Authorization: Bearer garbage` → 200
- `?limit=51` → 400; `?page=100000000000` → 400; `?search=yoga` → 400

- [ ] **Step 3: Run and confirm failure**

Run: `npm test -- catalog && npm run test:e2e -- catalog`
Expected: FAIL.

- [ ] **Step 4: Implement**

DTO: `@Type(() => Number) @IsInt() @Min(1)` on both, `@Max(50)` on `limit`, `@Max(10000)` on `page` (keeps the database offset in range). Controller: `@ApiTags('Catalog')`, `@Controller('catalog/classes')`, `findAll(@Query() query: CatalogPageQueryDto)`, no guards.

- [ ] **Step 5: Verify**

Run: `npm test && npm run test:e2e -- catalog && npm run lint && npm run build`
Expected: all pass. With `npm run start:dev`, `curl "http://localhost:3000/catalog/classes"` lists the test classes without a token.

- [ ] **Step 6: Stop for review.** Suggested message: `feat: add public GET /catalog/classes`

---

### Task 3: `GET /catalog/classes/:id`

**Files:**
- Modify: `src/catalog/catalog-classes.service.ts`, `catalog-classes.controller.ts`, `catalog-selects.ts`, `dto/catalog-class-response.dto.ts`, and their specs
- Test: `test/integration/catalog.integration-spec.ts`, `test/catalog.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `VENUE_SELECT` and `CatalogVenueDto` (the spec's Venue fields; used again in Task 5)
  - `CatalogSessionDto { id; startAt: string; endAt: string; totalCapacity: number; instructorName: string | null; venue: CatalogVenueDto }`
  - `CatalogClassDetailDto extends CatalogClassListItemDto { sessions: CatalogSessionDto[] }`
  - `CatalogClassesService.findOne(id: string, now?: Date): Promise<CatalogClassDetailDto>`

- [ ] **Step 1: Write the failing tests**

Integration:
- returns the class with exactly the spec's session and venue fields (`toEqual`; `instructorName` null with no instructor, the name with one)
- returns only visible sessions, earliest first (add a later, an earlier, a cancelled, a past, and a paused-plan session)
- never includes another class's sessions
- unknown id, and a class whose only session is cancelled, both reject with `NotFoundException('Class not found')`

E2E: `/catalog/classes/not-a-uuid` → 400; a valid unknown UUID → 404.

- [ ] **Step 2: Run and confirm failure:** `$DB npm run test:integration -- catalog && npm run test:e2e -- catalog`

- [ ] **Step 3: Implement**

`findOne` loads the class (`where: { id, ...visibleClassWhere(now) }`) and its sessions (`where: { AND: [visibleSessionWhere(now), { classPlan: { classTypeId: id } }] }`, ordered by `startAt`, `id`). Throw the 404 if the class is missing or has no sessions. Venue comes from the session, not the plan. Controller uses `ParseUUIDPipe`.

- [ ] **Step 4: Verify:** `$DB npm run test:integration && npm test && npm run test:e2e -- catalog && npm run lint && npm run build`. Expected: all pass.

- [ ] **Step 5: Stop for review.** Suggested message: `feat: add public class detail with upcoming sessions`

---

### Task 4: `GET /catalog/businesses`

**Files:**
- Create: `src/catalog/catalog-businesses.service.ts`, `catalog-businesses.controller.ts` and specs (Nest CLI, `--flat`)
- Create: `src/catalog/dto/catalog-business-response.dto.ts`
- Modify: `src/catalog/catalog-visibility.ts`
- Test: the integration and e2e specs

**Interfaces:**
- Consumes: `visibleClassWhere`, `CatalogPageQueryDto`
- Produces:
  - `visiblePartnerWhere(now: Date): Prisma.PartnerWhereInput`
  - `CatalogBusinessListItemDto { id; name; description: string | null }`
  - `CatalogBusinessPageDto { items; total; page; limit }`
  - `CatalogBusinessesService.findPage(page: number, limit: number, now?: Date): Promise<CatalogBusinessPageDto>`

- [ ] **Step 1: Generate** the service and controller.

- [ ] **Step 2: Write the failing tests**

Integration: lists a business with exactly `id`, `name`, `description`; hides an inactive partner, a partner with no classes, and a partner whose only session is cancelled; lists a business once when it has two visible classes; orders by name and pages with the correct `total`.

E2E: no token → 200 with an empty page; `?limit=51` → 400.

- [ ] **Step 3: Run and confirm failure.**
- [ ] **Step 4: Implement**, following Tasks 1 and 2. Query `partner` with `visiblePartnerWhere(now)`.
- [ ] **Step 5: Verify** with the Task 3 command. Expected: all pass.
- [ ] **Step 6: Stop for review.** Suggested message: `feat: add public business listing`

---

### Task 5: `GET /catalog/businesses/:id`

**Files:**
- Modify: the business service, controller, DTO file, and specs
- Test: the integration and e2e specs

**Interfaces:**
- Consumes: `VENUE_SELECT`, `CatalogVenueDto`, `CLASS_LIST_SELECT`, `toClassListItem`, `visiblePartnerWhere`, `visibleClassWhere`
- Produces: `CatalogBusinessDetailDto extends CatalogBusinessListItemDto { phone; websiteUrl; instagramHandle; xHandle; tiktokHandle; facebookUrl (all string | null); venues: CatalogVenueDto[]; classes: CatalogClassListItemDto[] }`, returned by `findOne(id: string, now?: Date)`

- [ ] **Step 1: Write the failing tests**

Integration:
- returns exactly the spec's fields (`toEqual`, so `status` and `bookingCutoffMinutes` cannot slip in)
- lists every `ACTIVE` venue, including one with no classes, and no `ARCHIVED` venue
- lists only this business's visible classes (not an archived one, not another partner's)
- unknown id and a hidden business both reject with `NotFoundException('Business not found')`

E2E: `not-a-uuid` → 400; a valid unknown UUID → 404.

- [ ] **Step 2: Run and confirm failure.**
- [ ] **Step 3: Implement.** Load the partner (with `ACTIVE` venues) and its classes (`{ partnerId: id, ...visibleClassWhere(now) }`); venues and classes ordered by name, then id.
- [ ] **Step 4: Verify** with the Task 3 command. Expected: all pass.
- [ ] **Step 5: Stop for review.** Suggested message: `feat: add public business detail`

---

### Task 6: Documentation and final check

**Files:**
- Modify: `README.md` ("Current API" and "Project Structure"), `docs/specs/0004-public-catalog.md` (status and a Verification section)

- [ ] **Step 1:** Document the four routes and `src/catalog/` in the README.
- [ ] **Step 2:** Run `$DB npm run test:integration && npm test && npm run test:e2e -- catalog && npm run lint && npm run build && npx tsc --noEmit`. Expected: all pass, except the one `supertest/types` error in `test/app.e2e-spec.ts` already recorded in spec 0003.
- [ ] **Step 3:** With the app running, call all four routes without a token against the test classes. Check that no response contains `classistaCapacity`, `bookingCutoffMinutes`, `status`, or `timezone`.
- [ ] **Step 4:** Record the actual results in the spec, including anything not verified.
- [ ] **Step 5: Stop for review.** Suggested message: `docs: document the public catalog`
