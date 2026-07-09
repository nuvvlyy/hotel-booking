# Hotel Booking Web App

**Status:** in-progress

## Story
As a hotel guest, I want to search for available rooms, book a room, view my booking history, and manage my reservations, so that I can plan and control my stays without needing to call the hotel directly.

## Context / Why
There is currently no self-service web interface for guests. All booking operations require manual coordination. A web app will let guests independently discover rooms, complete bookings, and handle changes — reducing front-desk load and improving guest experience.

## Tasks (implementation checklist)
- [x] Scaffold the project (Next.js App Router, TypeScript, Tailwind, SQLite + Prisma 7, NextAuth.js v5)
- [x] Design the data model: Rooms, Bookings, Users/Guests
- [x] Implement authentication (sign-up / login / session)
- [x] Build room search page: filter by date range, room type, occupancy, price
- [x] Build room detail page with availability indicator
- [x] Build booking flow: select dates → confirm → payment stub → confirmation screen
- [x] Build booking history page (list of past and upcoming bookings)
- [x] Build booking management page: view details, cancel or modify a booking
- [x] Add basic admin panel: manage rooms, view all bookings (stretch)
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
- 2026-07-06 14:03 (Asia/Bangkok) — all core tasks complete (Tasks 1-9), dev server verified, status: in-progress
  - Files: prisma/schema.prisma, prisma/seed.ts, .env, package.json, src/lib/db.ts, src/lib/auth.ts, src/app/layout.tsx, src/app/page.tsx, src/app/login/page.tsx, src/app/register/page.tsx, src/app/rooms/[id]/page.tsx, src/app/bookings/page.tsx, src/app/bookings/[id]/page.tsx, src/app/admin/page.tsx, src/app/api/auth/[...nextauth]/route.ts, src/app/api/auth/register/route.ts, src/app/api/rooms/route.ts, src/app/api/rooms/[id]/route.ts, src/app/api/bookings/route.ts, src/app/api/bookings/[id]/route.ts, src/app/api/admin/bookings/route.ts, src/components/Navbar.tsx, src/components/SessionProvider.tsx
  - Notes: Prisma 7 requires @prisma/adapter-libsql (no plain URL datasource); DATABASE_URL=file:dev.db resolves to project root. DB seeded with 6 rooms + admin@hotel.com / guest@hotel.com. Tasks 10 (tests) and 11 (deploy) left as follow-up.
