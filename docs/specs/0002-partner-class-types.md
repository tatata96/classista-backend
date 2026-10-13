# 0002. Partner Class Type management

**Date**: 2026-10-13
**Status**: Accepted (backend endpoints built; Class Plan integration not implemented yet)

## Summary

Partners list, create, edit, and archive reusable Class Types (for example "Puppy Yoga"), and later pick one when creating a Class Plan. Every Class Type belongs to one partner and one leaf category. Code lives in [src/class-types/](../../src/class-types/); the category read endpoint lives in [src/categories/](../../src/categories/).

## API

All `/partner/class-types` routes use `SupabaseAuthGuard` then `PartnerAccessGuard`. The partner always comes from the authenticated user's membership, never from the request. OWNER and STAFF have the same access.

| Route | Behavior |
|---|---|
| `GET /categories` | Public. Full category hierarchy (parents with their children). |
| `GET /partner/class-types?isActive=` | `true` (default when omitted) lists active types, `false` lists archived. Any other value is 400. |
| `POST /partner/class-types` | Creates an active Class Type. 201. |
| `PATCH /partner/class-types/:id` | Edits `name`, `categoryId`, `description` of an active type. |
| `POST /partner/class-types/:id/archive` | Sets `isActive` to false. 200. |

## Decisions

- **Editing an archived Class Type returns 409** with "Archived Class Types cannot be edited." The type exists, but its state conflicts with the edit. A concurrent archive between the check and the write is also reported as 409 (the update filters on `isActive: true`).
- **Only leaf categories are allowed.** `categoryId` must reference a category with no children. An unknown category or a parent category returns 400, on create and on edit when `categoryId` changes.
- **`GET /categories` returns the hierarchy with no search filter.** The earlier `?search=` only matched parent names, so it hid leaves (`?search=yoga` returned `[]`). The frontend searches the returned hierarchy locally. The response is parents with `children` (two levels, as seeded); a category with no children is a leaf.
- **Descriptions are trimmed; blank descriptions are stored as `null`.** `""`, whitespace-only, and an explicit `null` all become `null`, which is also how an edit clears a description. The 2,000-character limit applies after trimming. Names are trimmed and must be 1 to 150 characters.
- **Archiving preserves Class Plans and sessions.** Archive writes only `isActive` on the Class Type. It never pauses plans or cancels sessions, and existing references keep reading the Class Type's latest details (no snapshots). A Class Plan's own title is unaffected by renaming its Class Type.
- **Archive is idempotent.** Archiving an archived type returns it with no write. There is no delete or restore endpoint.
- **Other partner's or missing ids return the same 404** ("Class Type not found") on edit and archive.
- **Images are deferred.** `imageUrl` exists on the model but is neither accepted nor returned.

## Not implemented yet

- **Class Plan creation must reject archived Class Types.** Only active Class Types may be selectable for new Class Plans. Class Plan creation does not exist yet, so this rule is **not enforced anywhere today**. It must be added, with a test, when Class Plan creation is built.

## Verification

- Unit tests with mocked Prisma cover the service, controller, and DTO rules (validation, partner scoping, 404 and 409 paths, idempotent archive).
- Manual database checks, run once by hand: the seeded category hierarchy (2 parents, 31 and 38 children), the leaf check query (`yoga` has 0 children, `sports-movement` has 31), and that a no-match update filtered by `isActive: true` throws Prisma error `P2025`. The booted app was also checked to map the routes and return 401 without a token.
- **Not done:** no HTTP or database end-to-end tests, and no request with a real partner token. Partner isolation and the full create, edit, archive flow have not been exercised against a running app with real data.

## Follow-up

- [ ] Enforce "only active Class Types are selectable" when Class Plan creation is built.
- [ ] Add end-to-end tests (HTTP plus database) for the class-type routes.
- [ ] Image upload and editing for Class Types.
- [ ] Category tree is assumed to be two levels; revisit `GET /categories` if deeper nesting is ever seeded.
