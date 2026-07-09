# Room Reviews & Ratings — Technical Spec

## Context

Implements the PRD at `docs/prds/room-reviews-and-ratings.md`. Adds a `Review` model
tied 1:1 to completed bookings, with a guest-facing write flow (create/edit/delete),
a public read flow (room detail page + search cards), and admin moderation reusing
the same delete path. No test framework is configured in this repo (`package.json`
has no test script, no vitest/jest present) — every module below lists manual/browser
verification steps instead of automated test names.

## Decomposition

- **Data Model** — `Review` & `ReviewEdit` Prisma models
- **Review Domain Logic** (`src/lib/reviews.ts`) — eligibility, validation, aggregate rating
- **Booking Review API** — write path, `/api/bookings/[id]/review`
- **Room Reviews Read API** — read path, `/api/rooms/[id]/reviews` + aggregate fields
- **StarRating** — shared display/input component
- **Review UI Integration** — wiring into booking detail, room detail, search cards
- **Admin Review Moderation** — reuses Booking Review API's DELETE

## Modules

### Data Model — `Review` & `ReviewEdit`

**Responsibility:** Persist one review per completed booking and its edit history,
tied 1:1 to `Booking` with denormalized `roomId`/`userId` for query convenience.

**Public interface** (`prisma/schema.prisma` additions):
```prisma
model Review {
  id        String       @id @default(cuid())
  bookingId String       @unique
  roomId    String
  userId    String
  rating    Int
  comment   String?
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  booking   Booking      @relation(fields: [bookingId], references: [id])
  room      Room         @relation(fields: [roomId], references: [id])
  user      User         @relation(fields: [userId], references: [id])
  edits     ReviewEdit[]
}

model ReviewEdit {
  id              String   @id @default(cuid())
  reviewId        String?
  previousRating  Int
  previousComment String?
  editedAt        DateTime @default(now())
  review          Review?  @relation(fields: [reviewId], references: [id], onDelete: SetNull)
}
```
Also add back-relations: `Booking.review Review?`, `Room.reviews Review[]`, `User.reviews Review[]`.

**Invariants:**
- `bookingId` is unique (`@unique`) — the DB itself guarantees "one review per booking," no app-level race condition possible
- `rating` is application-validated as an Int 1-5 before every write (SQLite/Prisma has no CHECK-constraint enforcement here) — enforcement lives in `reviews.ts`, not in the schema
- `ReviewEdit` rows are append-only: written once per edit, never updated or deleted, and always committed before the corresponding `Review` update
- `ReviewEdit.reviewId` is nullable with `onDelete: SetNull` (not the Prisma default `Restrict` a required relation would get): a required, non-cascading FK would make `DELETE /api/bookings/[id]/review` throw a foreign-key-constraint error on any review that has edit history, which contradicts the "preserve audit history of a deleted review" goal below. `SetNull` lets the `Review` row disappear while `ReviewEdit` rows survive as orphaned history (`previousRating`/`previousComment` intact, `reviewId: null`).

**Failure modes:**
- Two concurrent creates for the same booking → the second fails the `@unique` constraint (Prisma error `P2002`); the API route catches this and returns 409
- A `Review` row is deleted (owner or admin) → its `ReviewEdit` rows survive with `reviewId` set to `null`, preserving audit history for admin reference (see nullable-FK invariant above)

**Tests (manual — no test framework configured):**
- Migration applies cleanly against the seeded dev DB; `npm run seed` still succeeds afterward
- Attempting a second `db.review.create` for the same `bookingId` throws a unique-constraint error

---

### Review Domain Logic — `src/lib/reviews.ts`

**Responsibility:** Own the review business rules — eligibility, input validation,
aggregate rating — in one place, so the write API, read API, and UI don't each
re-derive these checks independently.

**Why a shared module here, when the rest of this codebase keeps logic inline in route
handlers** (e.g. `src/app/api/bookings/[id]/route.ts` computes conflict checks and price
inline, no service layer): `isReviewEligible` alone is needed in three independent
places — the POST eligibility gate, the extended `GET /api/bookings/[id]`'s `canReview`
flag, and (indirectly) by anyone auditing why a 409 happened — duplicating a two-clause
boolean three times is a bigger maintenance risk than one small shared file. The
alternative (inline duplication, matching the codebase's ambient style exactly) was
considered and rejected specifically because this predicate, unlike the booking routes'
one-off conflict query, has no natural single call site. Everything else in this module
(`validateReviewInput`, the aggregate functions) stays here for the same reason — they're
each called from 2+ routes.

**Public interface:**
```typescript
export function isReviewEligible(booking: { status: string; checkOut: Date }): boolean;

export function validateReviewInput(input: { rating: unknown; comment?: unknown }):
  | { ok: true; rating: number; comment: string | null }
  | { ok: false; error: string };

export async function getRoomRatingSummary(
  roomId: string
): Promise<{ avgRating: number | null; reviewCount: number }>;

export async function getRoomRatingSummaries(
  roomIds: string[]
): Promise<Map<string, { avgRating: number | null; reviewCount: number }>>;
```

**Invariants:**
- `isReviewEligible` is the single definition of "can this booking be reviewed": `status === "CONFIRMED" && checkOut < new Date()`. No other file re-implements this check.
- `validateReviewInput` never throws — always returns a discriminated result; rejects non-integer or out-of-1-5-range ratings and comments over 1000 characters
- `getRoomRatingSummary(s)` return `avgRating: null` (not `0`) when `reviewCount === 0`, so callers can render "No reviews yet" instead of a misleading zero-star badge
- When `reviewCount > 0`, `avgRating` is rounded to 1 decimal place (e.g. `4.33333...` → `4.3`) before being returned — rounding happens once, in this module, so the API response, `StarRating` display, and the "★ 4.3 (12)" search badge all render the same number without each doing their own rounding
- `getRoomRatingSummaries` runs one grouped aggregate query for a batch of room IDs (not N+1 per room) — required by `GET /api/rooms`, which returns every matching room per search

**Failure modes:**
- None of these functions throw on bad input — `validateReviewInput` encodes failure in its return type; the rating functions return the zero-review shape rather than erroring on an empty relation

**Tests (manual):**
- `isReviewEligible` returns `false` for `PENDING`/`CANCELLED` status regardless of dates, and for `CONFIRMED` bookings with `checkOut` today or in the future
- `validateReviewInput` rejects `rating: 0`, `rating: 6`, `rating: 3.5`, and a 1001-character comment; accepts `rating: 1`..`5` with comment `null`/absent/≤1000 chars
- `getRoomRatingSummary` returns `{ avgRating: null, reviewCount: 0 }` for a room with no reviews, and a correct average for a room with 2+ reviews

---

### Booking Review API — `src/app/api/bookings/[id]/review/route.ts`

**Responsibility:** Let the owning guest create, edit, or delete the review tied to
their own completed booking; let an admin delete any review via the same DELETE
handler. Also extends the existing `GET /api/bookings/[id]` so the booking detail
page gets review state in its one existing fetch.

**Public interface** (HTTP contract, matching the existing route-handler pattern):
```
POST /api/bookings/[id]/review
  body: { rating: number, comment?: string }
  -> 201 Review
     400 (validation failure) | 401 | 403 (not owner)
     404 (booking not found) | 409 (not eligible yet, or already reviewed)

PATCH /api/bookings/[id]/review
  body: { rating?: number, comment?: string }
  -> 200 Review | 400 | 401 | 403 | 404 (no review exists to edit)

DELETE /api/bookings/[id]/review
  -> 200 { ok: true } | 401 | 403 (not owner and not admin) | 404
```
Extend the existing `GET /api/bookings/[id]` handler (`src/app/api/bookings/[id]/route.ts`)
to `include: { room: true, review: true }` and add a computed `canReview: boolean`
(`isReviewEligible(booking) && !booking.review`) to the JSON response.

**Invariants:**
- Ownership check (`session.user.id === booking.userId`) happens before the eligibility check, matching the existing `403`-then-`404` ordering already used in `src/app/api/bookings/[id]/route.ts`
- POST calls `isReviewEligible` before insert; PATCH/DELETE do **not** re-check eligibility — once a review exists it can always be edited/deleted by its owner, per the PRD requirement that a review is independent of the booking's later state
- PATCH writes a `ReviewEdit` row (capturing the pre-update `rating`/`comment`) and the `Review` update in a single `db.$transaction`
- DELETE authorization is `session.user.id === review.userId || session.user.role === "admin"` — one shared code path for both self-delete and admin moderation (no separate admin endpoint)

**Failure modes:**
- POST on an ineligible booking → 409 `{ error: "This stay hasn't been completed yet" }`
- POST when a review already exists → 409 `{ error: "You've already reviewed this booking" }` (checked explicitly, with the DB unique constraint as a fallback against races)
- PATCH/DELETE with no existing review → 404
- Any unauthenticated request → 401 before any DB read

**Tests (manual):**
- Owner POSTs a valid review on an eligible booking; a second POST returns 409
- POST on a booking with `checkOut` in the future returns 409; POST from a non-owner returns 403
- PATCH updates the review and creates exactly one new `ReviewEdit` row per call
- DELETE by the author succeeds; DELETE by a different non-admin guest returns 403; DELETE by an admin on someone else's review succeeds
- `GET /api/bookings/[id]` returns `canReview: true` for an eligible, unreviewed booking and `canReview: false` once a review exists

---

### Room Reviews Read API — `src/app/api/rooms/[id]/reviews/route.ts`

**Responsibility:** Serve the public, unauthenticated read side — the review list for
one room, and the aggregate rating attached to every room the app returns.

**Public interface:**
```
GET /api/rooms/[id]/reviews
  -> Array<Review & { user: { name: string } }>, newest first, no auth required

GET /api/rooms/[id]        (existing route, extended)
  -> Room & { avgRating: number | null, reviewCount: number }

GET /api/rooms             (existing route, extended)
  -> Array<Room & { avgRating: number | null, reviewCount: number }>
```

**Invariants:**
- The review list selects only `user: { name: true }` — never `email` or `id` — stricter than the admin bookings view (`src/app/api/admin/bookings/route.ts:11`, which selects `id, name, email` for authenticated admin use only)
- `avgRating`/`reviewCount` on `GET /api/rooms` come from `getRoomRatingSummaries` (batch), avoiding N+1 queries across a search results page

**Failure modes:**
- Room not found → existing 404 behavior on `GET /api/rooms/[id]` is unchanged; `GET /api/rooms/[id]/reviews` on a nonexistent room also 404s

**Tests (manual):**
- Search results (`GET /api/rooms`) include correct `avgRating`/`reviewCount` for rooms with 0, 1, and 3+ reviews
- Review list response omits reviewer email/id
- Review list is ordered newest-first

---

### StarRating — `src/components/StarRating.tsx`

**Responsibility:** Render a 1-5 star rating as either a read-only display or a
click-to-select input — one component, two modes, so star-rendering logic exists
in exactly one place across the app.

**Public interface:**
```typescript
type StarRatingProps =
  | { mode: "display"; value: number; size?: "sm" | "md" }
  | { mode: "input"; value: number; onChange: (rating: number) => void; size?: "sm" | "md" };

export function StarRating(props: StarRatingProps): JSX.Element;
```

**Invariants:**
- `display` mode never fires a callback and ignores clicks/hover — used in room cards, room detail header, and the review list
- `input` mode only ever calls `onChange` with an integer 1-5 (matches the domain rule that ratings are whole stars, no half-star input)

**Failure modes:** none — pure presentational component, no async or error state

**Tests (manual smoke test):**
- Both modes render 5 stars
- `input` mode calls `onChange(n)` when star `n` is clicked
- `display` mode with a fractional `value` (e.g. `4.3`, from an averaged rating) renders without throwing — exact fractional-fill vs. round-to-nearest behavior is decided during implementation (see Open Questions)

---

### Review UI Integration

**Responsibility:** Wire the write flow into the booking detail page, and the
read/display flow into the room detail page and search/home room cards. Pure
composition of Modules 2-5's outputs — no new business logic.

**Touch points:**
- `src/app/bookings/[id]/page.tsx` — extend the client `Booking` type with `review: Review | null` and `canReview: boolean` (now present on the extended `GET /api/bookings/[id]`). Below the existing cancel/modify block, render a `StarRating(mode="input")` + comment textarea when `canReview`, or the existing review with Edit/Delete actions when `booking.review` is set. Reuses the existing toggle-state pattern (`modifying` boolean → same shape for `reviewing`/`editingReview`).
- `src/app/rooms/[id]/page.tsx` — add a second fetch to `GET /api/rooms/[id]/reviews`; render `avgRating`/`reviewCount` next to the existing type badge via `StarRating(mode="display")`, and a review list below the existing amenities block
- `src/app/page.tsx` (search cards) — extend the client `Room` type with `avgRating`/`reviewCount` (already present on the extended `GET /api/rooms`); render `StarRating(mode="display", size="sm")` + count per card

**Invariants:**
- No new client-side state machines beyond what Modules 2-4 already expose — this module is purely presentational wiring
- "No reviews yet" (not a 0-star badge) renders whenever `reviewCount === 0`, via one shared conditional reused on both the room detail page and search cards — not two independently-written copies of the same check

**Failure modes:**
- If the room detail page's reviews fetch fails, the page still renders — the reviews section shows an inline error banner (same `error`-state pattern already used in `src/app/rooms/[id]/page.tsx`) rather than blocking the whole page

**Tests (manual, browser verification):**
- Guest with a completed, unreviewed booking sees "Leave a review" on `/bookings/[id]`
- Guest with a reviewed booking sees their review with Edit/Delete; editing updates the display and shows a "last edited" timestamp
- Guest with an ineligible booking (upcoming or cancelled) sees neither review prompt nor an existing review
- Room detail page shows the correct average and review list
- Search cards show correct badges, including "No reviews yet" for zero-review rooms

---

### Admin Review Moderation

**Responsibility:** Let an admin remove any review from the existing admin panel,
reusing the DELETE handler already specified in the Booking Review API module.

**Touch points:**
- `src/app/admin/page.tsx` — extend the existing bookings table to show each booking's attached review (if any) with a Delete action
- Reuses `DELETE /api/bookings/[id]/review` (no new endpoint) — its existing `role === "admin"` branch already covers this call site
- Extend `GET /api/admin/bookings` (`src/app/api/admin/bookings/route.ts`) to `include: { review: true }` so the admin table has review data in its existing fetch

**Invariants:**
- No separate admin-only review endpoint exists — one authorization code path (in the Booking Review API's DELETE handler) covers both self-delete and admin moderation

**Failure modes:** none beyond what the Booking Review API module already defines

**Tests (manual):**
- Admin sees each booking's attached review (if any) in the admin table
- Admin can delete another user's review; it disappears from the room's public review list and from `GET /api/rooms/[id]` aggregate afterward

## Sequence

1. **Data Model** — foundation; migrate schema, reseed dev DB
2. **Review Domain Logic** (`src/lib/reviews.ts`) — foundation; everything else depends on it
3. **Booking Review API — POST only** (tracer slice) — create-a-review path, skip PATCH/DELETE for now
4. **StarRating — input mode only** (tracer slice)
5. **Review UI Integration — booking detail write flow only** (tracer slice)
   ← **END OF TRACER BULLET:** a guest can leave a review end-to-end from `/bookings/[id]` (no display elsewhere, no edit/delete, no aggregate rating yet). This proves the new domain logic, new route, new component, and new DB writes all work together before building out the read-side fan-out.
6. **Room Reviews Read API** — GET reviews list, extend `GET /api/rooms` and `GET /api/rooms/[id]` with aggregates
7. **StarRating — display mode** + **Review UI Integration — room detail page and search cards**
8. **Booking Review API — PATCH/DELETE** + **Review UI Integration — edit/delete flow** on the booking detail page
9. **Admin Review Moderation** — last; depends on the DELETE handler already existing from step 3/8

## Open Questions

- `StarRating` display-mode fractional rendering: does a `4.3` average render with a partially-filled star, or round to the nearest whole star? (user decision, low-stakes — carried over from the PRD's star-widget open question, now scoped specifically to the averaged-rating display case since input is always a whole integer)
- Multiple reviews per room from repeat stays by the same guest: confirmed by the PRD as allowed (one review per booking, not per room) — no remaining ambiguity here, listed for traceability only

## Ambiguity Report

```
Ambiguity Report:
  Goals:        0.1   ✓ clear
  Acceptance:   0.1   ✓ clear
  Boundaries:   0.1   ✓ clear
  Alternatives: 0.15  ✓ clear
  Assumptions:  0.1   ✓ clear
  ──────────────────────────────
  Aggregate:    0.11  ✓ below threshold (0.2 spec)
```

Caught and fixed during grilling: `ReviewEdit.reviewId` was specified as a required
field with no `onDelete` action — Prisma's default for a required relation is
`Restrict`, which would have made `DELETE /api/bookings/[id]/review` throw a
foreign-key error on any review with edit history, directly contradicting the
"preserve audit history of a deleted review" requirement. Fixed by making the field
nullable with `onDelete: SetNull`. Also tightened: explicit rounding precision for
`avgRating` (1 decimal place, computed once in `reviews.ts`), and an explicit
alternatives-considered note for why `src/lib/reviews.ts` exists as a shared module
despite the codebase's otherwise-thin-route convention (three independent call sites
for `isReviewEligible`, vs. the booking routes' one-off inline checks).
