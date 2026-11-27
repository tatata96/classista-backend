# 0004. Public catalog (browsing without login)

**Date**: 2026-11-27
**Status**: Accepted (not built yet)

## Intent

People using the app without an account can browse classes and businesses, and see when a class takes place, before being asked to log in. Login is only needed to book.

## Goals

- List classes, and open one to see its upcoming dates.
- List businesses, and open one to see its details, venues, and classes.
- Never show anything that is not currently on offer.

## Non-goals

Booking, remaining seats, prices (none are stored), images (not supported yet), search and filters, a calendar across businesses, rate limiting, and any database change.

## Approaches

| Approach | Trade-off |
|---|---|
| **A. One `catalog` module (chosen)** | Visibility rules are written once and public code stays apart from partner code. One module reads several features' tables. |
| B. Public controllers inside `class-types` and `partners` | Each feature keeps its queries. Visibility rules are shared across modules and can drift. |
| Optional login on `/partner/...` routes (ruled out) | Those routes depend on knowing the partner; mixing audiences invites leaks. |

## Endpoints

New module in `src/catalog/`. No guards. All read-only.

| Route | Returns |
|---|---|
| `GET /catalog/classes?page=&limit=` | Page of visible classes |
| `GET /catalog/classes/:id` | One class and its upcoming sessions |
| `GET /catalog/businesses?page=&limit=` | Page of visible businesses |
| `GET /catalog/businesses/:id` | One business, its venues, and its visible classes |

A "class" is a Class Type. A "business" is a Partner.

- **Paging:** `page` starts at 1 (default 1); `limit` defaults to 20, maximum 50. Invalid values return 400. Response: `{ items, total, page, limit }`.
- **Order:** name, then id. The upcoming sessions of a class are ordered by `startAt`, then id.
- **Errors:** an id that is not a UUID returns 400. An unknown id and a hidden record return the same 404.

## Visibility rules

Defined once in `src/catalog/` and used by all four routes.

A **session** is visible when all of these hold:

- its status is `SCHEDULED`;
- `now < startAt <= now + 30 days` (the booking window from [0003](0003-class-plans.md), including for one-time classes);
- its Class Plan is `ACTIVE`;
- its Venue is `ACTIVE`;
- its Class Type is active;
- its Partner is `ACTIVE`.

A **class** is visible when it has at least one visible session. A **business** is visible when it has at least one visible class. A business page lists all of that business's `ACTIVE` venues.

A session stays visible after the partner's booking cutoff, until it starts. Showing that booking has closed belongs to the booking feature.

## Response fields

Only these fields are returned. Each query selects them explicitly.

| Object | Fields |
|---|---|
| Class (list item) | `id`, `name`, `description`, `category` (`id`, `name`), `business` (`id`, `name`) |
| Class (detail) | list item fields, plus `sessions` |
| Session | `id`, `startAt`, `endAt` (ISO 8601 UTC), `totalCapacity`, `instructorName` (or `null`), `venue` |
| Business (list item) | `id`, `name`, `description` |
| Business (detail) | list item fields, plus `phone`, `websiteUrl`, `instagramHandle`, `xHandle`, `tiktokHandle`, `facebookUrl`, `venues`, `classes` (class list items, not paged) |
| Venue | `id`, `name`, `addressLine`, `district`, `city`, `postalCode`, `latitude`, `longitude`, `phone`, `amenityIds` |

- `totalCapacity` is shown because 0003 displays it as "Up to 30 participants".
- Never returned: `classistaCapacity`, `bookingCutoffMinutes`, statuses, venue timezone, member or user data.

## Testing

- Unit tests for the services, controllers, and paging validation.
- Integration tests against the local test database, one for each visibility rule, showing the record is hidden.
- An HTTP test showing the four routes answer without a token.

## Left to the builder

File layout inside `src/catalog/` (existing features live directly under `src/`), DTO names, and how the 30-day constant is shared with session generation.
