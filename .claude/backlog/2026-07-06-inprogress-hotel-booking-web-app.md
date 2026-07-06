# Hotel Booking Web App

**Status:** in-progress

## Story
As a hotel guest, I want to search for available rooms, book a room, view my booking history, and manage my reservations, so that I can plan and control my stays without needing to call the hotel directly.

## Context / Why
There is currently no self-service web interface for guests. All booking operations require manual coordination. A web app will let guests independently discover rooms, complete bookings, and handle changes — reducing front-desk load and improving guest experience.

## Tasks (implementation checklist)
- [ ] Scaffold the project (framework choice: Next.js or React + Node/Express backend, PostgreSQL or SQLite DB)
- [ ] Design the data model: Rooms, Bookings, Users/Guests
- [ ] Implement authentication (sign-up / login / session)
- [ ] Build room search page: filter by date range, room type, occupancy, price
- [ ] Build room detail page with availability indicator
- [ ] Build booking flow: select dates → confirm → payment stub → confirmation screen
- [ ] Build booking history page (list of past and upcoming bookings)
- [ ] Build booking management page: view details, cancel or modify a booking
- [ ] Add basic admin panel: manage rooms, view all bookings (stretch)
- [ ] Write integration tests for booking creation and cancellation
- [ ] Deploy to a hosting platform (Vercel, Railway, or similar)

## Acceptance criteria
- [ ] Guest can search for rooms by check-in date, check-out date, and number of guests and see only rooms available for that period
- [ ] Guest can complete a booking for a selected room and receive a booking confirmation with a unique reference number
- [ ] Guest can view a list of all their bookings (past and upcoming) after logging in
- [ ] Guest can cancel an upcoming booking from the management page; the room becomes available again for that date range
- [ ] Guest can modify dates of an upcoming booking if the new dates are available
- [ ] Booking a room that is already taken for the requested dates is blocked and shows a clear error

## Out of scope
- Real payment gateway integration (a stub/placeholder is sufficient for this card)
- Multi-property / multi-hotel support
- Staff/housekeeping workflow beyond a basic admin room list
- Mobile native app (web-responsive only)
- Email/SMS notification system

## Commits

## History
- 2026-07-06 11:30 (Asia/Bangkok) — created, status: draft
- 2026-07-06 11:46 (Asia/Bangkok) — implementation started, status: in-progress
