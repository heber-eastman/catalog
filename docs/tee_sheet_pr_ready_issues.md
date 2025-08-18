
# Tee Sheet Module (V1) — PR‑Ready GitHub Issues & TDD Code‑Gen Prompts
> Copy each section into a new GitHub Issue. Each issue includes a **TDD code‑gen prompt** inside a `text` code fence for your code‑generation LLM.  
> Aligned to your repo stack: **Express + Sequelize + PostgreSQL + Joi + JWT + SES**, **Vue 3 + Vuetify + Vite + Pinia + Vue Router**, **Jest/Supertest, Vitest, Cypress**.

---

## Epic: Tee Sheet Module (V1) — Master Tracking

**Summary**  
Track the delivery of the full Tee Sheet module across backend, frontend, and ops, aligned to the Customers module and platform architecture.

**Includes**  
Issues #1–#16 below.

**Acceptance Criteria**
- All child issues closed.
- Demo env with seeded data shows end‑to‑end flow: staff grid add/move/cancel; customer browse/cart/book; waitlist offer accept; admin manage schedule & closures; printing works.

**Checklist**
- [ ] All issues closed
- [ ] Demo walkthrough recorded
- [ ] Release notes drafted

**Labels:** `epic`, `v1`, `tee-sheet`

---

## 1) DB Models & Migrations (Sequelize) — Tee Sheet Domain

**Summary**  
Add Sequelize models/migrations for the Tee Sheet domain per the aligned spec.

**Scope**
- Models & migrations: `TeeSheet`, `TeeSheetSide` (effective‑dated), `DayTemplate`, `Timeframe`, `TimeframeAccessRule`, `TimeframePricingRule`, `TimeframeRoundOption`, `TimeframeRoundLegOption`, `TimeframeMinPlayers`, `TimeframeMode`, `CalendarAssignment`, `ClosureBlock`, `TeeTime`, `Booking`, `BookingRoundLeg`, `TeeTimeAssignment`, `TeeTimeWaitlist`.
- Associations, indexes, constraints.

**Out of scope**  
Routes/jobs/Redis — separate issues.

**Acceptance Criteria**
- Migrations apply cleanly.
- Models export with associations.
- Unit tests cover key invariants (uniques & basic relations).

**Testing**
- Jest model tests on isolated test db/schema.
- Verify unique `(tee_sheet_id, side_id, start_time)` on `TeeTime`.
- Verify unique `(tee_sheet_id, date)` on `CalendarAssignment`.

**Dependencies:** none  
**Labels:** `backend`, `db`, `tee-sheet`

**TDD Code‑Gen Prompt**
```text
Goal: Add tee‑sheet domain models in Sequelize with migrations and unit tests.

Steps:
1) Create migrations + models for:
   - TeeSheet, TeeSheetSide (effective‑dated)
   - DayTemplate, Timeframe(+AccessRule, PricingRule, MinPlayers, Mode), RoundOption(+LegOption)
   - CalendarAssignment, ClosureBlock
   - TeeTime
   - Booking, BookingRoundLeg, TeeTimeAssignment
   - TeeTimeWaitlist
2) Add associations and indexes (see spec for uniqueness).
3) Write Jest tests that create sample data and verify constraints (unique start_time per side, non-overlap timeframes by service validation).

Deliverables:
- Sequelize models + migrations
- /backend/src/models/__tests__/*.test.ts covering basic invariants
```

---

## 2) Rules Helpers (Pure Functions)

**Summary**  
Implement pure helper functions for reround timing, slot snapping, class access, fee calculation, and min player enforcement.

**Scope**
- `/backend/src/lib/teeRules/*` with pure functions + 100% unit coverage.
- Timezone & sunrise/sunset adapters (mockable).

**Acceptance Criteria**
- Helpers exported and used by later services.
- Unit tests pass across DST/sunrise edge cases.

**Dependencies:** #1  
**Labels:** `backend`, `rules`, `tee-sheet`

**TDD Code‑Gen Prompt**
```text
Goal: Implement tee‑sheet rules helpers with 100% unit coverage.

Create /backend/src/lib/teeRules/:
- computeReroundStart(sideConfig, startTime)  // minutesPerHole * holeCount
- snapToNextSlot(teeTimesInOrder, targetTime) // return the TeeTime at or after target
- isClassAllowed(timeframe, bookingClassId)
- calcFeesForLeg(pricingRules, classId, walkRide)
- enforceMinPlayers(timeframe, partySize)

Add time utils:
- sunrise/sunset adapter (mockable)
- course timezone helper; DST handling

Tests:
- Edge cases: DST transitions, sunrise/sunset mock values, intervals changing mid-day.
```

---

## 3) Calendar Assignment & Closure Blocks (Admin)

**Summary**  
Admin endpoints for recurring/day assignments and closure blocks.

**Scope**
- `POST /api/tee-sheets/:id/calendar` (bulk/recurring + overrides)
- `POST /api/tee-sheets/:id/closures` (side/full‑day)
- Joi validation; admin guard; service rules (block change if bookings exist).

**Acceptance Criteria**
- Endpoints documented; Supertest integration tests pass.
- Attempting to change a date with bookings yields a validation error.

**Dependencies:** #1, #2  
**Labels:** `backend`, `api`, `admin`, `tee-sheet`

**TDD Code‑Gen Prompt**
```text
Goal: Admin endpoints for assigning templates and creating closures.

Routes (Express):
- POST /api/tee-sheets/:id/calendar   // bulk assign recurring + overrides
- POST /api/tee-sheets/:id/closures   // side or full-day

Validation: Joi schemas. Guard: admin middleware.

Tests (Supertest):
- Cannot change assignment on a date with bookings.
- Closure creates windows and later-generated slots are auto-blocked.
```

---

## 4) Slot Generation Job (Cron + Manual Trigger)

**Summary**  
Generate `TeeTime` rows from timeframes nightly and on clean‑day assignment.

**Scope**
- Generator service (carry‑forward stepping; closure auto‑block; DST).
- Cron at 00:05 local per course; ENV‑guarded manual trigger for CI: `POST /internal/generate?date=YYYY-MM-DD`.

**Acceptance Criteria**
- Generator produces unique rows, respects closures.
- DST rules honored (skip non-existent; include both repeated).

**Dependencies:** #1, #2, #3  
**Labels:** `backend`, `jobs`, `tee-sheet`

**TDD Code‑Gen Prompt**
```text
Goal: Generate TeeTime rows per day/timeframe.

Implement:
- Generator service: carry-forward stepping; apply interval per timeframe; mark closure windows as isBlocked.
- Cron job at 00:05 local per course; endpoint POST /internal/generate?date=YYYY-MM-DD for CI (env-guarded).

Tests:
- Unit: generator logic (multi-side, double-tee, DST cases).
- Integration: after assigning template, generator creates unique slots and respects closures.
```

---

## 5) Availability API (Customer + Staff)

**Summary**  
Implement availability listing with reround validation, pricing view logic, filters, and visibility rules.

**Scope**
- `GET /api/tee-times/available` with filters.
- Customer visibility (allowed classes only; hide blocked); staff view indicates blocked.

**Acceptance Criteria**
- Strict party size check across **both** legs.
- Pricing display follows combine‑fees and mode rules.

**Dependencies:** #1, #2, #4  
**Labels:** `backend`, `api`, `tee-sheet`

**TDD Code‑Gen Prompt**
```text
Goal: Customer/staff availability listing with reround validation and pricing display.

Route:
- GET /api/tee-times/available?date=...&teeSheets[]=...&timeStart=...&timeEnd=...&groupSize=...&roundOptionId=...&walkRide=...

Behavior:
- Customers see only allowed slots for their effective booking class; blocked slots hidden.
- For 18: only return starts whose reround slot has capacity for full party.
- Pricing per side + class; combine-fees toggle respected.

Tests:
- Supertest queries with seeds; verify filtering, reround feasibility, and pricing strings.
```

---

## 6) Redis Coordination (Idempotency, Holds, Rate Limits)

**Summary**  
Add Redis‑backed idempotency and unified 5‑minute cart hold; booking‑attempt caps (user/IP).

**Scope**
- `Idempotency-Key` middleware (10m result cache).
- `/holds/cart` unified 5m hold per user; waitlist holds take precedence; capacity blocks.
- Attempt caps: user 5/10m (2m cooldown) & IP 20/10m (5m cooldown).

**Acceptance Criteria**
- Duplicate side‑effect requests return same result within TTL.
- Holds reduce capacity and expire to restore capacity.

**Dependencies:** #1, #4, #5  
**Labels:** `backend`, `redis`, `tee-sheet`

**TDD Code‑Gen Prompt**
```text
Goal: Add Redis-backed idempotency and unified 5m cart hold; booking-attempt caps.

Implement:
- Middleware: require Idempotency-Key for POST /bookings, PATCH /bookings/:id/reschedule, DELETE /bookings/:id, POST /holds/cart, POST /waitlist/:id/accept.
- Holds: POST /holds/cart starts/refreshes a 5m hold; one active hold per user; blocks capacity on listed slots; waitlist holds take precedence.
- Rate limits: per-user and per-IP; reuse existing limiter if present.

Tests:
- Redis integration: ensure duplicate requests return same result; holds reduce capacity and expire correctly.
```

---

## 7) Booking Create (Cart All‑or‑Nothing)

**Summary**  
Create bookings with validations, transactions, and per‑leg assignments; all‑or‑nothing cart.

**Scope**
- `POST /api/bookings`
- Validate: windows, access on both legs, min players (timeframe), mode, capacity across legs; per‑player walk/ride required (default Riding when allowed).

**Acceptance Criteria**
- Transactions lock affected `TeeTime` rows; `assigned_count` updated atomically.
- Prices locked at booking time (per leg).

**Dependencies:** #1, #2, #5, #6  
**Labels:** `backend`, `api`, `tee-sheet`

**TDD Code‑Gen Prompt**
```text
Goal: Implement POST /api/bookings (cart all-or-nothing).

Implement:
- Validation: windows/access/min/mode across both legs; per-player walk/ride required (default Riding when both allowed).
- Transaction: lock affected TeeTime rows (SELECT FOR UPDATE), insert Booking + legs + assignments; update assignedCount.
- Notifications: email owner/invited (SES); SMS optional.

Tests:
- 9- and 18-hole success; min-fail; capacity race; access denied; window not open.
```

---

## 8) Reschedule & Cancel

**Summary**  
Implement reschedule and cancel flows with cutoffs, overrides, notifications, and audits.

**Scope**
- `PATCH /api/bookings/:id/reschedule` (same tee sheet; across dates OK)
- `DELETE /api/bookings/:id` (customer cutoff; staff/admin override)

**Acceptance Criteria**
- Reschedule recalculates prices to new slot rules; releases old legs.
- Cancel notifies all verified players; audit logged.

**Dependencies:** #7  
**Labels:** `backend`, `api`, `tee-sheet`

**TDD Code‑Gen Prompt**
```text
Goal: PATCH /api/bookings/:id/reschedule and DELETE /api/bookings/:id.

Behavior:
- Reschedule must pass validations; prices recalc to target rules; release old legs.
- Cancel enforces customer cutoff; staff/admin override allowed; audit + notify.

Tests:
- Reschedule happy paths + failure reasons.
- Cancel within cutoff blocked for customer; allowed for staff.
```

---

## 9) Waitlist (Join/Offer/Accept/Promote)

**Summary**  
Slot + flexible waitlist; oldest‑first offers; 5‑minute offer holds; manual promote.

**Scope**
- `POST /api/waitlist` (join)
- Offer creation on capacity open; `POST /api/waitlist/:id/accept` (magic link) → converts to cart hold; `POST /api/waitlist/:id/promote` for staff.

**Acceptance Criteria**
- Eligibility enforced by booking class (both legs for 18).
- Full party required to accept an offer.

**Dependencies:** #1, #2, #6, #7  
**Labels:** `backend`, `api`, `tee-sheet`

**TDD Code‑Gen Prompt**
```text
Goal: Implement slot/flex waitlist, offers, and accept via magic link.

Routes:
- POST /api/waitlist  // join
- POST /api/waitlist/:id/accept  // magic link accept -> converts to cart hold
- POST /api/waitlist/:id/promote  // staff manual promote (sends offer)

Tests:
- Oldest-first offer; full-party requirement; precedence of waitlist holds; expiry handling.
```

---

## 10) Audit & Notifications

**Summary**  
Event logging & comms: BookingEvent/SlotEvent + SES/SNS + 24h reminders.

**Scope**
- Log create/move/reschedule/cancel/holds/waitlist.
- SES templates; optional SNS; 24h reminder cron.

**Acceptance Criteria**
- Events persisted with actor + reason where applicable.
- Reminder selects bookings 24h out (course‑local).

**Dependencies:** #7, #8, #9  
**Labels:** `backend`, `ops`, `tee-sheet`

**TDD Code‑Gen Prompt**
```text
Goal: Bookings and Slots event logging + comms.

Implement:
- BookingEvent/SlotEvent repositories; write on create/move/reschedule/cancel/holds/waitlist.
- SES email templates; 24h reminder cron job.

Tests:
- Events written; reminder selects bookings 24h out; emails mocked.
```

---

## 11) Staff UI — Tee Sheet Grid (Vue + Vuetify)

**Summary**  
Build the staff tee sheet per UI spec: grid, chips, drawer, DnD, live updates.

**Scope**
- Route `#/tee-sheet` with header (Prev/Date/Next, Switcher, View Mode, Color‑by, Today, Settings admin‑only).
- Single‑Side & Split views; sticky time column; N seat columns.
- Booking chips (status colors), reround badge + delayed tooltip; inline “+ Add booking”; drawer with Players/Reround/Notes/Pricing/History/Actions.
- DnD: chip move (soft‑guard fail dialog); row‑level move (all‑or‑nothing; can switch sides if rules allow). Live updates via Socket.IO/SSE.

**Acceptance Criteria**
- Admin quick Block/Unblock action from row overflow (reason prompt).
- Auto‑scroll to first slot / now; stay‑put on live changes with highlight + toast.

**Dependencies:** #5, #7, #8, #10  
**Labels:** `frontend`, `vue`, `vuetify`, `tee-sheet`

**TDD Code‑Gen Prompt**
```text
Goal: Build the tee sheet grid and interactions in the staff frontend.

Implement:
- Route /tee-sheet with header (Prev/Date/Next, switcher, View Mode, Color-by, Today, Settings if admin).
- Single-Side and Split views; side selectors; auto-scroll to first slot / now.
- Grid rows (time) x seat columns; booking chips (status colors); reround badge + delayed tooltip; inline +Add booking.
- Drawer with Players/Reround/Notes/Pricing/History/Actions.
- DnD with soft-guard failure dialog; row-level move (all-or-nothing; can switch sides if rules allow).
- Live updates via Socket.IO/SSE; highlight + toast; no auto-follow.
- Admin quick Block/Unblock on row overflow.

Tests:
- Vitest unit tests for components; Cypress e2e for add/move/cancel and blocked visuals.
```

---

## 12) Customer UI — Browse + Cart + My Tee Times

**Summary**  
Customer browse with eligibility, cart with unified hold, and “My Tee Times”.

**Scope**
- Browse: tee sheet multi‑select, filters, pricing rules, hide disallowed.
- Cart: unified 5m hold; owner must be a player; per‑player walk/ride required.
- My Tee Times: reschedule (picker) and cancel (cutoffs).

**Acceptance Criteria**
- Strict capacity check across both legs (party size).
- Pricing display matches combine‑fees toggle and mode selection.

**Dependencies:** #5, #6, #7, #8  
**Labels:** `frontend`, `vue`, `tee-sheet`

**TDD Code‑Gen Prompt**
```text
Goal: Customer browse + cart + my tee times.

Implement:
- Browse list with tee sheet multi-select, filters, and pricing view rules.
- Cart with unified 5m hold; owner must be a player; per-player walk/ride required.
- My Tee Times: reschedule (picker) and cancel; enforce rules.

Tests:
- Cypress flows for browse/book/reschedule/cancel; hold timer behavior.
```

---

## 13) Admin Settings UI

**Summary**  
Admin‑only settings sections mapped to backend.

**Scope**
- Subpages: General; Tee Sheets & Sides; Day Templates; Timeframes; Calendar Assignment; Closure Blocks; Booking Classes; Waitlist & Holds.
- Validations mirror backend; generation trigger for clean dates.

**Acceptance Criteria**
- Non‑overlap validation visible to admin.
- Assigning template on clean dates immediately generates slots.

**Dependencies:** #3, #4  
**Labels:** `frontend`, `admin`, `tee-sheet`

**TDD Code‑Gen Prompt**
```text
Goal: Admin settings screens mapped to backend.

Implement subpages:
- General; Tee Sheets & Sides; Day Templates; Timeframes; Calendar Assignment; Closure Blocks; Booking Classes; Waitlist & Holds.

Tests:
- Form validations; preview daytime bands; generation only on clean dates.
```

---

## 14) Printing & Mobile

**Summary**  
Add print‑friendly “Today’s Tee Sheet” and simplified mobile/tablet flows.

**Scope**
- Print view (PDF): player names, party, walk/ride, booking notes, reround side/time, blocked indicators.
- Mobile/tablet: per‑side list; create booking; add/remove players; cancel; no DnD.

**Acceptance Criteria**
- Print view renders correctly with Vuetify.
- Mobile flows pass Cypress viewport tests.

**Dependencies:** #11  
**Labels:** `frontend`, `ux`, `tee-sheet`

**TDD Code‑Gen Prompt**
```text
Goal: Print and simplified mobile/tablet UX.

Implement:
- Print “Today’s Tee Sheet” (names, party, walk/ride, notes, reround, blocked).
- Mobile/tablet per-side list; create booking; add/remove players; cancel.

Tests:
- Cypress mobile viewport tests; print snapshot.
```

---

## 15) E2E & Concurrency

**Summary**  
Protect core flows with Cypress and add a concurrency harness for booking races.

**Scope**
- Cypress: end‑to‑end staff and customer flows.
- Supertest concurrency harness for race conditions on final seats.

**Acceptance Criteria**
- No double‑booking under race tests.
- E2E green in CI with seeded data.

**Dependencies:** #7–#12  
**Labels:** `testing`, `e2e`, `tee-sheet`

**TDD Code‑Gen Prompt**
```text
Goal: protect the core flows with Cypress and booking race tests.

Tasks:
1) E2E: customer browse→add→book 9 & 18; reschedule; cancel; waitlist accept; staff grid inline add; DnD move; admin closure block.
2) Concurrency harness: simulate race on last spot via parallel Supertest clients; assert no double-booking.

Output:
- CI scripts to run e2e; reports archived.
```

---

## 16) Final Wiring, Seed & Swagger

**Summary**  
Wire OpenAPI docs, seed demo data, environment docs, and stabilize.

**Scope**
- Swagger via `swagger-ui-express` + `swagger-jsdoc` for new endpoints.
- Seed demo course, tee sheet (Front/Back), templates, timeframes, assignments, generated dates.
- `.env.example` updates; scripts to run generator and purge holds/waitlists in dev.

**Acceptance Criteria**
- Fresh clone can start DB/Redis, run migrations/seeds, boot backend/frontend, and use tee sheet end‑to‑end.
- All unit/integration/e2e tests green.

**Dependencies:** #1–#15  
**Labels:** `release`, `docs`, `tee-sheet`

**TDD Code‑Gen Prompt**
```text
Goal: Wire, seed, and stabilize.

Tasks:
1) Add Swagger (swagger-ui-express + swagger-jsdoc) for new endpoints.
2) Seed demo data: one course, one tee sheet (Front/Back), templates, timeframes, assignments, generated dates.
3) Ensure envs are documented; add npm scripts to run generator and purge holds/waitlists in dev.
4) Run Jest + Vitest + Cypress; fix flakes; commit.

Acceptance:
- Fresh clone can start DB/Redis, run migrations/seeds, start backend/frontend, and use tee sheet end-to-end.
```
