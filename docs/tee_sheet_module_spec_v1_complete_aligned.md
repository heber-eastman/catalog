
# Tee Sheet Module Spec — Complete & Aligned (Express + Sequelize + Vue 3)

> **Purpose:** A full, hand‑offable specification for the Tee Sheet module that **follows the patterns/stack** in the `catalog` repo.  
> **Status:** V1 (complete) — replaces prior drafts.  
> **Stack Alignment:** Express.js + Sequelize (PostgreSQL), Joi, JWT; Vue 3 + Vuetify + Vite + Pinia; Redis for holds/idempotency; SES (email) + SNS (SMS).

---

## 0) Glossary
- **Course**: A golf facility in the platform.
- **Tee Sheet**: A schedule for a set of physical holes (e.g., “Championship 18”, “Executive 9”). A course may have multiple tee sheets.
- **Side**: A contiguous subset of holes within a tee sheet (e.g., “Front 9”). Each side has `hole_count` and `minutes_per_hole`.
- **Timeframe**: A rule segment within a day template (per side) with its own start/end, interval, access, pricing, min players, walk/ride mode, and round options.
- **Round Option**: A sequence of sides (legs) such as “9” (Front) or “18” (Front→Back).
- **Slot (TeeTime)**: A generated time entry on a side (row in the grid). Capacity is shared across bookings up to `max_golfers_per_slot`.
- **Booking**: A reservation that occupies 1+ legs (start + reround) for N players.
- **Booking Class**: Access/pricing group used for booking (separate from membership types). Public class is the default for logged-out.
- **CustomerProfile**: Course‑scoped profile for a platform User.

---

## 1) Implementation Stack Alignment

**Backend**
- Express.js API, Sequelize ORM (PostgreSQL), Joi validation, JWT auth
- Redis (holds, idempotency, rate limits), node‑cron for jobs
- SES email; SNS SMS (10DLC) with verified opt‑in
- Tests: Jest unit/integration with Supertest

**Frontend**
- Vue 3 + Vuetify 3 (Vite), Pinia state, Vue Router
- Tests: Vitest + Vue Test Utils; Cypress E2E

**CI/CD & Ops**
- Reuse existing Docker/ECS/RDS/CloudFront pipeline
- .env per environment; feature flags via env

---

## 2) Identity & Tenancy

### 2.1 User (platform‑wide)
- Fields: `id`, `email?` (unique), `phone_e164?` (unique), `email_verified_at?`, `phone_verified_at?`, `sms_opt_in` (bool), `name`, timestamps.
- At least one verified contact is required for **self‑booking** (staff can book customers without verification).

### 2.2 CustomerProfile (course‑scoped)
- Fields: `id`, `course_id`, `user_id`, `membership_type_id?`, `booking_class_override_id?`, `membership_status` (Active/Inactive/Pending/Lapsed), timestamps.
- Unique (`course_id`,`user_id`). Auto‑created on first interaction with a course.
- User updates (name/email/phone) **propagate to all profiles.**

### 2.3 MembershipType & BookingClass
- `MembershipType(course_id, name, is_active)` — already exists; reused.
- `BookingClass(course_id, name, is_public_default, max_days_in_advance DEFAULT 7, daily_release_local TIME DEFAULT '00:00', is_active)`.
- Mapping: `MembershipTypeBookingClass(membership_type_id, booking_class_id)` (unique pair).
- Effective booking class precedence: **Profile override → MembershipType mapping → course public default**.

### 2.4 Auth options
- Magic link (email/phone), social (Google/Apple), optional password fallback. Use existing JWT/session patterns.

---

## 3) Tee Sheets & Sides

### 3.1 TeeSheet
- Fields: `id`, `course_id`, `name`, `is_active`, `combine_fees` (bool, default false),  
  `max_golfers_per_slot` (required), `gen_window_days` (default 30),  
  `cancellation_cutoff_minutes` (default 60), `booking_cutoff_minutes` (default 60), `edit_cutoff_minutes` (default 60),  
  `show_player_names` (bool, default false), timestamps.
- Max golfers enforced for **everyone** (no per‑class max).

### 3.2 TeeSheetSide (effective‑dated)
- Fields: `id`, `tee_sheet_id`, `name`, `sort_order`, `hole_count`, `minutes_per_hole`, `effective_date`, timestamps.
- Insert future rows to change layout; past days keep prior rows.

---

## 4) Day Templates, Timeframes & Rules

### 4.1 DayTemplate
- `id`, `tee_sheet_id`, `name`, timestamps.

### 4.2 Timeframe (per template, per side)
- `id`, `day_template_id`, `side_id`,
- **Start**: `start_mode` = `fixed` or `sunrise_offset`; `start_time?` or `start_offset_mins?`
- **End**: `end_mode` = `fixed` or `sunset_offset`; `end_time?` or `end_offset_mins?`
- `interval_mins` (default 10)
- `start_slots_enabled` (bool, default true)
- `reround_allowed` (bool, default true)
- Non‑overlap per side within a template.

### 4.3 Access & Pricing
- **Access**: `TimeframeAccessRule(timeframe_id, booking_class_id, allowed)` — unspecified classes are **denied**.
- **Pricing (per side)**: `TimeframePricingRule(timeframe_id, booking_class_id, greens_fee_cents, cart_fee_cents)`
  - If `TeeSheet.combine_fees = true`, present combined price. Otherwise show separate (“From $W” logic in UI).

### 4.4 Round Options & Min Players & Modes
- Round options per timeframe: `TimeframeRoundOption(id, timeframe_id, name, legs)`; `TimeframeRoundLegOption(round_option_id, sequence, side_id)` defines ordered sides.
- Min players: `TimeframeMinPlayers(timeframe_id, min_players DEFAULT 1)` — enforced on create/edit; admin can override.
- Walk/Ride: `TimeframeMode(timeframe_id, allowed ENUM('walking','riding','either'))` — for multi‑leg rounds **both legs must allow chosen mode**.

### 4.5 Day Template Assignment
- Apply DayTemplates to dates via Calendar (below). The **schedule can be determined by sunrise/sunset offsets**.

---

## 5) Calendar Assignment & Closure Blocks

### 5.1 CalendarAssignment
- `id`, `tee_sheet_id`, `date`, `day_template_id`, unique (`tee_sheet_id`,`date`).
- Supports recurring assignment (Mon–Fri / Sat–Sun) and explicit date overrides.
- **Guard:** Changing assignments on dates **with bookings** is blocked; bookings must be moved/cancelled first.

### 5.2 ClosureBlock
- `id`, `tee_sheet_id`, `side_id?`, `date`, `start_time?`, `end_time?`, `reason`, timestamps.
- Default behavior: generator creates slots but marks them **is_blocked** if within closure window.
- Applying a closure that overlaps booked slots is **refused**.

---

## 6) Slot Generation (TeeTime)

### 6.1 TeeTime
- `id`, `tee_sheet_id`, `side_id`, `start_time TIMESTAMPTZ`, `is_blocked` (bool), `blocked_reason?`, `assigned_count INT DEFAULT 0`, `version INT DEFAULT 0`, timestamps.
- Unique: (`tee_sheet_id`,`side_id`,`start_time`).
- No “status” column — derive open/partial/full from `assigned_count` vs `max_golfers_per_slot`.

### 6.2 Generation rules
- Trigger:
  - On assigning a template for a date **with no bookings**, generate immediately.
  - Nightly cron at **00:05 course‑local** extends the window to `gen_window_days`.
- **Carry‑forward stepping:** keep stepping by `interval_mins`. When crossing into a new timeframe, continue stepping using the new timeframe’s interval.
- **Start vs Reround‑only:** depends on `start_slots_enabled`. Reround‑only rows are visible to staff and used for validation/legs but may not show “+ Add booking” unless the timeframe also allows starts on that side/time.
- **Closures**: slots within closure windows are generated as `is_blocked = true` with reason.

### 6.3 Timekeeping & DST
- Store all times as TIMESTAMPTZ; compute sunrise/sunset and daily releases in course timezone (IANA).
- DST: Spring forward — skip non‑existent local times; Fall back — generate both repeated times (UI labels indicate STD/DST).

---

## 7) Availability & Visibility (API/View Behavior)

- Customers see only **allowed** starts for their effective booking class.
- **Strict reround feasibility**: for multi‑leg (e.g., 18), a start is visible only if the computed reround slot exists and has capacity for the **full party**.
- If reround slot isn’t available, **do not offer** an 18‑hole start; if 9‑hole is allowed, show the 9‑only option.
- Blocked slots are **hidden** from customer browse; staff can see the block indicator.
- Filters: date, tee sheets (multi‑select within current course), time range, group size, round option, walk/ride.

---

## 8) Booking Model & Logic

### 8.1 Core entities
- `Booking(id, course_id, tee_sheet_id, owner_user_id, created_by_user_id?, created_by_staff_id?, booking_class_id, source ENUM('customer','staff'), status ENUM('confirmed','cancelled') DEFAULT 'confirmed', total_players_cached, notes, version, timestamps)`
- `BookingRoundLeg(id, booking_id, sequence, side_id, tee_time_id, timestamps)`
- `TeeTimeAssignment(id, booking_id, tee_time_id, user_id?, customer_profile_id, status ENUM('booked','cancelled') DEFAULT 'booked', walk_ride ENUM('walking','riding'), greens_fee_cents, cart_fee_cents, timestamps)`

### 8.2 Capacity & seats
- Per‑slot capacity = `TeeSheet.max_golfers_per_slot` (global per tee sheet). Multiple bookings can share a slot up to capacity.
- No overbooking. No per‑timeframe max override.

### 8.3 Owner & players
- Staff creating a booking must add at least one customer; the first player becomes the **owner**.
- The **owner must be a player**; they cannot remove themselves (must cancel). Staff/admin can transfer ownership or change any player.
- Customers can invite guests (even if the guest’s class is different). Guests are priced by **their own class**.
- Customers can **double‑book/overlap** tee times (allowed).

### 8.4 Walk/Ride & pricing
- Per‑player walk/ride is required (default **Riding** when both allowed). Mode must be allowed by **all legs** of the round.
- Pricing is per‑side, per‑timeframe, per‑booking‑class. If `combine_fees = true`, show combined totals; otherwise “From $W” logic applies.
- Prices are **locked** at booking time; on **reschedule** prices **recalculate** using the new slot’s rules.

### 8.5 Minimum players
- Enforce `TimeframeMinPlayers.min_players` on create/edit.
- If a booking drops below min, mark **Needs players** with a **24h grace** (truncated to same‑day cutoff). Auto‑cancel if not restored.

### 8.6 Windows & cutoffs
- **Booking windows**: `BookingClass.max_days_in_advance` and `BookingClass.daily_release_local` (per class).
- **Same‑day booking cutoff**: per tee sheet (`booking_cutoff_minutes`).
- **Edit cutoff**: per tee sheet (`edit_cutoff_minutes`).
- **Cancellation cutoff**: per tee sheet (`cancellation_cutoff_minutes`).

### 8.7 Reround computation
- Reround start time = sum(previous leg `minutes_per_hole * hole_count`), then **snap forward** to the next available generated slot time on the target side.
- Start + reround legs are **both required** for multi‑leg rounds and must have capacity for the full party.

### 8.8 Cart & multi‑booking
- Customer cart supports **up to 5 bookings** (same course; can span multiple tee sheets).  
- Cart is **all‑or‑nothing** (transactional failure rolls back all).

---

## 9) Holds, Idempotency & Rate Limits (Redis)

- **Unified checkout hold**: 5 minutes per user (one active hold); adding items **resets** timer; holds reduce slot capacity.
- **Waitlist offer hold**: 5 minutes; **takes precedence** over checkout holds.
- **Precedence on regeneration**: if slot regeneration is triggered, **delete all active holds** for impacted slots before regenerating.
- Admins can clear holds (audit logged).
- **Idempotency**: required `Idempotency-Key` on side‑effects; 10‑minute cache of responses keyed by (user, route, request hash).
- **Attempt caps**: per‑user 5/10m (2m cooldown), per‑IP 20/10m (5m cooldown).

---

## 10) Reschedule & Cancel

- **Reschedule** within the same tee sheet (across days OK via picker), subject to all validations (windows/access/min/mode/cutoffs). Prices **recalculate**.
- **Cancel**: customers are subject to the cancellation cutoff; staff/admin can override. Sends notifications (verified contacts only).
- Owner can’t remove themselves — they cancel instead. Staff/admin can transfer owner.

---

## 11) Waitlist

- Modes: **slot‑level** or **flexible window** (date + time range + side/tee sheet constraints).
- Customer specifies **party size** and **round option** (holes) when joining.
- Offers are **oldest‑first**, regardless of waitlist mode; **full‑party only** offers (don’t offer partial).
- Accepting an offer uses a single‑use magic link → auto‑signs in → converts to a **5‑minute checkout hold** → standard booking flow.
- Manual **Promote** in staff UI sends the same 5‑minute offer.
- Waitlists can trigger inside the same‑day cutoff; staff can fulfill anyway.
- On template regeneration, **purge impacted waitlists** and notify users.

---

## 12) Notifications

- Channels: **SMS** (if opted‑in and verified) else **Email** (SES). Only verified contacts receive messages.
- Events:
  - Booking confirmations, cancellations
  - Waitlist joins & offers (with accept links)
  - **24h reminders** (course‑local time)
- Platform‑brand sender identity; templates localized by course.

---

## 13) Auditing & Retention

- Events: `BookingEvent` and `SlotEvent` on create/edit/move/reschedule/cancel; holds placed/expired/cleared; waitlist join/offer/accept/expire; auto‑cancel (grace); DST notes; actor + reason.
- Retention:
  - Bookings, assignments, slots: keep indefinitely.
  - Waitlists & holds: purge after **30 days**.
  - Audit events: keep **365 days**.
- Account deletion:
  - (a) Delete from **this course** (removes CustomerProfile) or  
  - (b) Delete **entire account** (User + all profiles). PII anonymized; operational data retained.

---

## 14) API Surface (Express)

> All endpoints are **course‑scoped** (use course context from subdomain or header). All side‑effect routes require `Idempotency-Key` and JWT.

### 14.1 Auth (reuse existing)
- `POST /auth/magic-link` (email or phone)  
- `POST /auth/magic-link/confirm`  
- Social callbacks (`/auth/google/callback`, `/auth/apple/callback`)  
- `POST /auth/refresh`, `POST /auth/logout`

### 14.2 Browse & Availability
- `GET /api/tee-times/available`
  - Query: `date`, `teeSheets[]`, `timeStart`, `timeEnd`, `groupSize`, `roundOptionId`, `walkRide`
  - Customer: only allowed starts; hide blocked. Staff: see blocked flag.

### 14.3 Bookings
- `POST /api/bookings` — cart all‑or‑nothing; owner must be player; per‑player walk/ride required.
- `PATCH /api/bookings/:id/reschedule` — compute reround; prices recalc.
- `PATCH /api/bookings/:id/players` — add/remove/transfer owner; enforce mins (admin override allowed).
- `DELETE /api/bookings/:id` — cancel with reason (optional); cutoffs enforced for customer; staff/admin override.

### 14.4 Holds & Waitlist
- `POST /api/holds/cart` — start/refresh/release unified hold.
- `POST /api/waitlist` — join (slot or flex).
- `POST /api/waitlist/:id/accept` — magic link accept → hold → booking flow.
- `POST /api/waitlist/:id/promote` — staff manual promote (sends offer).

### 14.5 Admin: Schedule & Generation
- `GET/POST/PUT /api/tee-sheets` — admin only.
- `GET/POST /api/tee-sheets/:id/sides` — effective‑dated inserts.
- `GET/POST/PUT /api/tee-sheets/:id/templates` — timeframes, rules, pricing, min players, mode, round options.
- `GET/POST /api/tee-sheets/:id/calendar` — assignments (recurring + overrides).
- `POST /api/tee-sheets/:id/closures` — closures.
- `POST /internal/generate?date=YYYY-MM-DD` — test/CI only (env‑guarded).

---

## 15) Staff UI (Vue + Vuetify)

### 15.1 Navigation & Landing
- Main nav: **Tee Sheet** (staff), **Settings** (admins only). Landing opens **last used tee sheet**; header switcher shows others.
- Settings button (admin‑only) deep‑links to “Settings → Tee Sheet”. Show a **Today** button when viewing a non‑today date.

### 15.2 Header Controls
`[◀ Prev] [Date Picker] [Next ▶] | [Tee Sheet Switcher] | [View: Single / Split] | [Color by: Status ▾] | [Settings]*`
- Side selector appears in Single‑Side view.
- Customer quick search to highlight/jump to a golfer’s bookings for that day.
- **Auto‑refresh** via websocket; “Live” indicator; changes highlight + toast; **stay‑put** (no auto‑follow).
- Persist per‑user prefs: last tee sheet, view mode, selected sides (split), color scheme, time format (12/24h), drawer open/closed.

### 15.3 Grid & Chips
- **Rows = time** (sticky left column). **Columns = seats** (N = max_golfers_per_slot).
- Color‑by default = **Status**: Confirmed (green), Needs players (amber), Held (blue), Cancelled today (red outline + strikethrough). Picker can switch schemes in future.
- **Booking chip (compact):** `Owner Last (N)` + tiny class tag + walk/ride icon (or “mix”). Reround badge (“18” with link icon); hover tooltip (delayed) shows players, walk/ride mix, reround side/time, notes snippet.
- Quick actions “⋯”: Reschedule, Add/Remove player, Transfer owner, Cancel.
- Per‑player walk/ride quick‑toggle on chip hover (if both allowed).

### 15.4 Creating & Editing
- Empty capacity shows **“+ Add booking”** (inline micro‑add): defaults **longest round**, **max party**, **Riding**; then open drawer for owner/players/walk‑ride/notes.
- Drawer sections: **Players** (owner badge, add/remove), **Reround** (legs list + jump), **Notes**, **Pricing** (read‑only), **History**, **Actions** (Reschedule, Transfer owner, Cancel). Contact info appears **only in the drawer**.

### 15.5 Drag & Drop
- **Chip DnD** to another row (same day). **Soft guard**: allow drop anywhere; show dialog if invalid (no suggestions).
- **Row‑level DnD** by dragging the time cell moves **all bookings in the row** (all‑or‑nothing). May switch sides if rules allow starting there. **Start + reround always move together**.
- Cross‑day reschedules use the **Reschedule** action (date picker → slot grid).

### 15.6 Special Rows & Blocking
- Reround‑only rows are visible to staff; **no “+ Add booking”** unless starts are allowed by the timeframe at that time/side.
- Blocked rows: dim + “Blocked” pill; reason on hover.
- Quick Block/Unblock in row overflow (admin‑only; reason required). **Undo snackbar** (5s) for move/cancel/block/unblock.

### 15.7 Mobile & Tablet
- Simplified per‑side list: **browse, create booking, add/remove players, cancel**. No drag/drop. Drawer simplified.

### 15.8 Printing
- Print‑friendly **Today’s Tee Sheet** (PDF): player names, party size, walk/ride, booking notes, reround side/time, blocked indicator. Staff‑only; unaffected by public visibility.

---

## 16) Customer UI

- **Browse** for a day with tee sheet multi‑select (within current course); show only allowed starts; hide blocked; strict reround feasibility.
- **Cart** with unified 5‑minute hold; owner must be in players; per‑player walk/ride required; **all‑or‑nothing** checkout (max 5 bookings).
- **My Tee Times**: show other players in bookings; reschedule (same tee sheet) & cancel with rules.

---

## 17) Permissions & Roles

- **Admin**: all schedule configuration (templates/timeframes/calendar/closures), cutoff overrides, clear holds, quick block/unblock, transfer ownership; delete bookings but **never delete slots**.
- **Staff/Manager**: create/edit/delete bookings; add/delete customers to bookings (can create new customer inline with **name only**); drag/move bookings; cancel; cannot block/unblock or change schedule.
- **Customers**: create/reschedule/cancel their own bookings (cutoffs enforced), invite guests, remove players (not owner).

---

## 18) Concurrency & Transactions

- All booking/reschedule/cancel operations run in a DB transaction.
- Lock all affected `TeeTime` rows (`SELECT ... FOR UPDATE`), re‑check capacity/min/access/mode/cutoffs, update `assigned_count` atomically, commit.
- Optimistic concurrency via `version` on mutable rows; 409 on mismatch.
- Idempotency keys required on all side‑effects.

---

## 19) Data Retention & Privacy

- See §13 for event/hold/waitlist retention.
- GDPR/CCPA style deletion: course‑scoped or global account deletion; PII anonymized; historical operational data retained for audit.

---

## 20) Seeds & Demo Data

- Seed one demo course with: 
  - one tee sheet (“Championship 18”) with 2 sides (Front/Back, 9 holes each, 10 min/hole),  
  - booking classes (Public default, Member),  
  - one template with timeframes (e.g., sunrise‑10:00 walking‑only, 10:00‑17:00 either),  
  - calendar assignment for a week,  
  - generated slots, and a few demo bookings.
- Include customer users (public & member), plus a staff/admin account.

---

## 21) Non‑Functional Requirements

- **Performance:** Availability endpoint ≤ 400ms P95 for a single day with two sides and two tee sheets; booking create ≤ 700ms P95.
- **Reliability:** Prevent double‑booking under race; holds never leave capacity stuck on expiry.
- **Security:** JWT best practices; rate limit brute force; verified contacts only receive notifications.
- **Observability:** Structured logs; metrics (bookings/sec, hold expiries, waitlist conversions); error tracing.

---

## 22) Migration Plan

- No live customers — perform a **single big release**:
  1) Apply new tables/migrations.
  2) Deploy API & UI.
  3) Seed demo data.
  4) Enable tee sheet routes.

---

## 23) Future Work (Not in V1)

- Payments & taxes; POS integration
- Cart inventory for physical carts
- Command bar & keyboard shortcuts
- Bulk actions (multi‑row block/cancel)
- Cross‑course aggregation for staff
- Advanced pricing rules/discounts
- Thresholds/consequences for no‑shows/short‑shows

---

## Appendix A — Minimal Sequelize Model Notes (indicative)

> These outline fields/constraints only; full associations/indexes are defined in migrations.

- **TeeSheet**: `combine_fees`, `max_golfers_per_slot`, `gen_window_days`, cutoffs (booking/edit/cancel), `show_player_names`  
- **TeeSheetSide**: `hole_count`, `minutes_per_hole`, `effective_date`  
- **DayTemplate** & **Timeframe**: start/end modes, `interval_mins`, `start_slots_enabled`, `reround_allowed`  
- **TimeframeAccessRule**: deny‑by‑default  
- **TimeframePricingRule**: per side + class; fees in cents  
- **TimeframeRoundOption**/**LegOption**: ordered leg sequences  
- **TimeframeMinPlayers**: per timeframe, default 1  
- **TimeframeMode**: walking/riding/either  
- **CalendarAssignment**: unique per date per tee sheet  
- **ClosureBlock**: side/window or full day; reason  
- **TeeTime**: unique (`tee_sheet_id`,`side_id`,`start_time`), `is_blocked`, `assigned_count`, `version`  
- **Booking**/**BookingRoundLeg**/**TeeTimeAssignment**: owner is player, per‑player mode, fees locked on create  
- **TeeTimeWaitlist**: slot or flex; oldest‑first offers; 5‑min offer hold

---

## Appendix B — UI Color Defaults (Status scheme)

- **Confirmed**: Emerald‑600 (`#16A34A`)
- **Needs players**: Amber‑500 (`#F59E0B`)
- **Held (checkout/waitlist)**: Blue‑600 (`#2563EB`)
- **Cancelled today**: Red‑600 outline, 30% opacity, strikethrough

(Ensure accessible contrast; add subtle hatch for Held to assist color‑blind users.)

