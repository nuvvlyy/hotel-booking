# Room Reviews & Ratings

## Goals

Let guests leave a star rating and optional written comment for a room after their
stay has completed, and surface an aggregate rating to other guests during search
and on the room detail page. This gives future guests social proof beyond the
existing description/amenities, while the "verified stay" gate (booking must be
CONFIRMED and check-out must have passed) keeps reviews tied to real stays.

## Requirements

- [ ] A guest with a CONFIRMED booking whose `checkOut` date is in the past can submit exactly one review (1-5 integer star rating, required, no half-stars; text comment, optional, max 1000 characters) for that booking
- [ ] Comment length is validated both client-side (form) and server-side (API route rejects >1000 chars with a 400); rating outside 1-5 or non-integer is rejected the same way
- [ ] A review, once submitted, is independent of the booking's current state — later modifying the booking's dates (even pushing check-out back into the future) does not hide, lock, or delete the existing review
- [ ] The guest's booking detail page (`/bookings/[id]`) shows a "Leave a review" action once the stay is eligible, and shows the existing review (with an edit/delete option) if one was already submitted
- [ ] A guest can edit their own review's rating and/or comment at any time; each edit is recorded in an audit history (visible to admins only) and the review displays a "last edited" timestamp to all viewers
- [ ] A guest can delete their own review at any time
- [ ] The room detail page (`/rooms/[id]`) shows the average star rating, total review count, and a list of individual reviews (reviewer name, rating, comment, submitted/edited date)
- [ ] Room cards in search results and the home page show the average star rating and review count as a compact badge (e.g. "★ 4.5 (12)")
- [ ] A room with zero reviews shows "No reviews yet" instead of a 0-star badge, both on the detail page and search cards
- [ ] An admin can delete any review from the admin panel (moderation), gated by the existing `role === "admin"` check
- [ ] Deleting a review does not affect the underlying booking record; cancelling or modifying a booking does not delete an existing review tied to it

## Non-Goals

- Review "helpfulness" voting, replies/responses from hotel staff, or photo attachments
- Changes to the booking cancellation/modification flow itself
- Automated review-request notifications/emails/reminders — guest navigates to their booking manually to leave a review
- Publicly visible edit diffs — only admins can see prior versions via the audit trail
- Reviews for CANCELLED or still-upcoming (checkOut in the future) bookings
- A user-facing "report/flag" feature — moderation is admin-initiated only, not crowd-sourced
- Automated profanity/spam/content filtering on comments — only a max-length check is enforced programmatically; inappropriate content relies entirely on admin manual deletion after the fact

## Constraints

- This app targets a modified Next.js — per `AGENTS.md`, check `node_modules/next/dist/docs/` for breaking changes/conventions before writing route handlers or pages; don't assume standard Next.js 16 behavior from training data
- Auth: every API route handler calls `auth()` from `@/lib/auth` per-request (no shared middleware layer currently exists); ownership checks compare `session.user.id` to the record's `userId`. Admin routes additionally check `(session.user as { role?: string }).role === "admin"` (see `src/app/api/admin/bookings/route.ts:6-9`)
- `Booking.status` is a free-text string (`"CONFIRMED" | "CANCELLED" | "PENDING"`, no enum in schema) — eligibility check is `status === "CONFIRMED" && checkOut < now`
- Prisma 7 generates the client to `src/generated/prisma` via `@prisma/adapter-libsql`; any new model needs a migration through the existing `prisma/schema.prisma` + `prisma.config.ts` setup, and the dev DB is seeded via `prisma/seed.ts` (`npm run seed`)
- No existing `Review` model, no role enum, no aggregate/denormalized rating field on `Room` — average rating must be computed (either on read via a Prisma aggregate query, or denormalized with a background update on write; existing codebase has no precedent for denormalization, so computing on read matches current style)
- The room list API (`GET /api/rooms`, `src/app/api/rooms/route.ts`) currently returns raw `Room` records with no joined data — adding a rating badge to search cards means this endpoint needs to also return average rating + review count per room
- UI conventions to follow: Tailwind utility classes, rounded-2xl white cards with shadow-md, blue-600 primary actions, red-400/500 destructive actions, inline error banners (see `src/app/rooms/[id]/page.tsx` and `src/app/bookings/[id]/page.tsx` for the established pattern)

## Approach

1. **Schema**: add a `Review` model to `prisma/schema.prisma` — `id`, `bookingId` (unique, one-to-one with `Booking`), `roomId`, `userId`, `rating` (Int, 1-5), `comment` (String?, nullable), `createdAt`, `updatedAt`. Add a `ReviewEdit` model for the audit trail — `id`, `reviewId`, `previousRating`, `previousComment`, `editedAt` — written on every update before the `Review` row changes. Run a migration and reseed if needed.
2. **API routes**: follow the existing `/api/bookings/[id]` pattern —
   - `POST /api/bookings/[id]/review` — create (enforces eligibility: owns booking, CONFIRMED, checkOut < now, no existing review)
   - `PATCH /api/bookings/[id]/review` — update (writes a `ReviewEdit` row, then updates `Review`)
   - `DELETE /api/bookings/[id]/review` — delete (owner or admin)
   - `GET /api/rooms/[id]/reviews` — list reviews for a room (public, no auth required, matches `GET /api/rooms/[id]` being unauthenticated)
   - Extend `GET /api/rooms` and `GET /api/rooms/[id]` to include `avgRating` and `reviewCount`, computed at request time via a Prisma `_avg`/`_count` aggregate on the `Review` relation (decided over denormalizing onto `Room`: no existing precedent for denormalized/cached fields in this codebase, and at single-hotel/dozens-of-rooms scale the extra aggregate query has no meaningful cost — avoids the write-side consistency risk of keeping a cached field in sync across create/update/delete)
   - Reviews nest under `/api/bookings/[id]/review` (write path) and `/api/rooms/[id]/reviews` (read path) rather than a standalone `/api/reviews` resource — matches the existing convention where every resource's sub-actions live under that resource's route (e.g. booking cancel/modify is `PATCH /api/bookings/[id]`, not a generic `/api/booking-actions`)
3. **UI**: 
   - `src/app/bookings/[id]/page.tsx` — add review form/display block, following the existing modify/cancel button pattern (inline form toggle, same button/error styling)
   - `src/app/rooms/[id]/page.tsx` — add a reviews section below the existing room info card
   - `src/app/page.tsx` (search cards) and any other room-card rendering — add the star rating badge
   - New shared component, e.g. `src/components/StarRating.tsx`, for rendering both the input (booking page) and read-only display (room page, cards) — avoids duplicating star-rendering logic
4. **Admin**: extend `src/app/admin/page.tsx` and add `DELETE` handling to an admin reviews endpoint (or extend the existing admin bookings view to show/delete the attached review) — reuse the `role === "admin"` gate pattern from `src/app/api/admin/bookings/route.ts`

## Open Questions

- Should a guest with multiple completed bookings for the *same* room be able to leave a separate review per booking, or should the UI collapse/merge them into one review per room? (user decision — default assumed: one review per booking, so a guest could have multiple reviews for the same room if they stayed more than once)
- Exact star-rating UI widget (click-to-select 5 stars vs. a numeric dropdown) — (user decision, low-stakes, can be resolved during implementation)

## Discoveries

<!-- Populated during execution as agents find unexpected things -->

## Ambiguity Report

```
Ambiguity Report:
  Goals:        0.1   ✓ clear
  Acceptance:   0.1   ✓ clear
  Boundaries:   0.1   ✓ clear
  Alternatives: 0.2   ✓ clear
  Assumptions:  0.1   ✓ clear
  ──────────────────────────────
  Aggregate:    0.12  ✓ below threshold (0.2 spec)
```

Resolved during grilling: comment length cap (1000 chars, validated client+server), rating
must be an integer 1-5, review independence from later booking modifications, and the
rating-computation approach (compute-on-read via Prisma aggregate, with the denormalization
alternative explicitly considered and rejected). Two open questions remain (multi-booking
review handling for repeat stays; exact star-widget UI) — both tagged as low-stakes user
decisions in Open Questions above, not load-bearing ambiguity.
