# Tickets: Room Reviews & Ratings

Vertical-slice tickets implementing the Room Reviews & Ratings feature. Source spec:
`docs/prds/room-reviews-and-ratings.md` (the "what") and
`docs/tech-specs/room-reviews-and-ratings.md` (the "how" — module interfaces, invariants,
failure modes, and the tracer-bullet sequencing this breakdown follows).

Work the **frontier**: any ticket whose blockers are all done. This chain is linear —
work top to bottom.

## Guest can leave a review after a completed stay

**What to build:** A guest with a CONFIRMED booking whose check-out date has passed can
submit a 1-5 star rating (required) and an optional comment (max 1000 characters) for
that booking, from the booking detail page. This is the tracer bullet: it proves the
new data model, domain logic, API route, UI component, and page wiring all work
end-to-end before anything reads or displays the review elsewhere.

**Blocked by:** None — can start immediately.

- [x] `Review` model added to the schema (one review per booking, enforced at the DB level via a unique constraint on the booking reference)
- [x] Shared eligibility/validation logic exists in one place: a booking is reviewable only when its status is confirmed and its check-out date is in the past; rating must be an integer 1-5; comment must be ≤1000 characters
- [x] An endpoint lets the owning guest create a review for their own eligible, not-yet-reviewed booking; returns clear errors for: not signed in, not the owner, booking not eligible yet, booking already reviewed, invalid rating/comment
- [x] A shared star-rating UI component exists and supports a click-to-select input mode
- [x] The booking detail page shows a "Leave a review" star input + comment box when the booking is eligible and unreviewed, and shows the submitted review (read-only) immediately after submitting

## Room and search pages show ratings

**What to build:** Guests browsing rooms see the aggregate rating for each room —
average star rating and review count on the room detail page (with the full list of
reviews) and as a compact badge on search/home result cards. Rooms with no reviews
show "No reviews yet" instead of a misleading zero-star badge.

**Blocked by:** Guest can leave a review after a completed stay (needs the `Review`
model and write path to have real reviews to display).

- [ ] An endpoint returns the list of reviews for a room (reviewer name, rating, comment, date), newest first, without exposing reviewer email — no authentication required
- [ ] Room search/listing and room detail responses include each room's average rating and review count, computed without an extra query per room
- [ ] The shared star-rating component supports a read-only display mode
- [ ] The room detail page shows the average rating, review count, and full review list
- [ ] Search/home result cards show a rating badge, or "No reviews yet" when a room has zero reviews

## Guest can edit or delete their review

**What to build:** A guest can change their star rating and/or comment, or remove their
review entirely, at any time after submitting — independent of what happens to the
underlying booking afterward (date changes, etc. don't affect an existing review).
Edited reviews show a "last edited" indicator; the pre-edit values are preserved in an
audit trail for admin reference (not shown to other guests).

**Blocked by:** Guest can leave a review after a completed stay.

- [ ] An audit-history model captures the rating/comment as they stood before each edit
- [ ] An endpoint lets the review's author update their review's rating and/or comment at any time, recording the prior values to the audit history in the same operation
- [ ] An endpoint lets the review's author delete their own review at any time; deleting a review does not affect the underlying booking, and the audit history for that review is preserved even after the review itself is gone
- [ ] The booking detail page lets the guest edit or delete their existing review, and shows a "last edited" timestamp on reviews that have been changed

## Admin can moderate reviews

**What to build:** An admin can see every booking's attached review (if any) in the
admin panel and remove any review, for content moderation — reusing the same delete
capability guests use on their own reviews, authorized for admins on any review.

**Blocked by:** Room and search pages show ratings (need the public review list/rating
to verify a deleted review actually disappears from guest-facing views); Guest can
edit or delete their review (reuses its delete endpoint — no new admin-only route).

- [ ] The admin panel shows each booking's attached review (rating, comment, author) where one exists
- [ ] An admin can delete any review from the admin panel, regardless of who wrote it
- [ ] After an admin deletes a review, it no longer appears in the room's public review list, and the room's average rating/review count update accordingly
