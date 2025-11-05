
# Catalog POS v1 (Cash + Search) — Cursor Project Plan (Vue Edition)

**Audience:** Cursor + GPT-5 Thinking (pair-programming).  
**Scope:** Build a minimal, production-quality POS inside Catalog (Vue stack): search → cart → discounts/tax → **cash** payment → receipt (email/PDF) → inventory decrement → Z report; **per-tenant** and **per-location** aware. No card readers, no barcode scanning, no offline.

---

## 0) Executive Summary

We will deliver a thin POS integrated into Catalog’s **Vue** front end. The build is split into small, independently-mergeable PRs with strong tests and explicit acceptance criteria. Hardware, card-present payments, split tenders, barcode scanning, and offline mode are out of scope for v1.

**Success criteria**
- Product search by name/SKU/brand/category with pagination; add/remove items, adjust qty, line or cart discounts.
- Cash checkout: capture amount received, compute change due, require an open register shift.
- Inventory decrement committed atomically with the sale; never below zero.
- Z report (by date, location, shift) + CSV export.
- Tenant/location isolation enforced on every API call.
- Meaningful logs/metrics around checkout and inventory writes.
- Comprehensive tests: unit, API, and E2E happy/edge paths.

---

## 1) Architectural Assumptions (Vue-focused)

- **Front end:** Vue 3 + Composition API, **Vue Router**, **Pinia** for state, **Vite** build.  
- **UI:** Tailwind (or your existing design system components).  
- **Forms/validation:** vee-validate + zod or your standard.  
- **Testing:** Vitest + Vue Test Utils for unit; **Playwright** for E2E.  
- **Backend:** Existing Catalog API layer (Node/TS or your stack) as previously planned.  
- **Auth/Tenancy:** Reuse Catalog auth; derive `tenantId`/`locationId` from session/context.  
- **Observability:** Structured logs on backend (saleId, tenantId, locationId, shiftId); front end only minimal error reporting.

---

## 2) Data Model (unchanged from plan)

Entities: `Sale`, `SaleLine`, `Payment (cash)`, `InventoryLedger`, `RegisterShift` + existing `Product`, `Location`, `Tenant`, `User`.

SQL-ish schema and invariants are identical to the prior plan.

---

## 3) API Contracts (OpenAPI-style)

Endpoints and payloads are identical to the prior plan:
- `GET /pos/products/search`
- `POST /pos/cart/price`
- `POST /pos/checkout/cash` (Idempotency-Key)
- `POST /pos/shifts/open|close`, `GET /pos/shifts/active`
- `GET /pos/report/z` and `/pos/report/z.csv`

Standard error codes: 409/400/403/412.

---

## 4) Vue UI Specifications

**Routes (Vue Router)**
- `/pos/register`
- `/pos/report`
- `/pos/settings`

**Pages (SFCs)**
- `views/pos/PosRegisterPage.vue`
- `views/pos/ZReportPage.vue`
- `views/pos/LocationSettingsPage.vue`

**Components (SFCs)**
- `components/pos/ProductSearch.vue` — debounced search, filters, paginated list
- `components/pos/Cart.vue` — owns line rendering and summary
  - `components/pos/CartLine.vue`
  - `components/pos/CartSummary.vue`
- `components/pos/CheckoutCashDialog.vue`
- `components/pos/ShiftBanner.vue`

**State (Pinia stores)**
- `stores/pos/cart.ts`  
  - state: `lines`, `cartToken`, `pricing` (subtotal, discounts, tax, total)  
  - actions: `addLine`, `updateQty`, `removeLine`, `applyLineDiscount`, `applyCartDiscount`, `priceCart`
- `stores/pos/shift.ts`  
  - state: `activeShift`  
  - actions: `openShift`, `closeShift`, `fetchActiveShift`
- `stores/pos/settings.ts`  
  - state: `taxRate`, `receiptFooter`, `canDiscount`  
  - actions: `loadSettings`
- Use an existing `useSession()` for `tenantId`/`locationId` context.

**UX Notes**
- Debounce search (300ms) via `watch` + `setTimeout` or `lodash.debounce`.
- Keyboard-friendly qty updates (+/-), and Enter to add from search.
- Disable checkout when no active shift.
- After successful checkout, show receipt actions (email/download) and “New sale”.

**Styling**
- Tailwind utility classes (or your design system). Keep tablet-first breakpoints.
- Reusable table and form components from your UI kit.

---

## 5) Milestones & Tasks (Vue + API, PR-sized)

### M0 – Bootstrap & Wiring (0.5–1 day)
- Router: register `/pos/...` routes and a left-nav entry (feature flag).  
- Create placeholder SFCs for pages and components listed above.  
- Back end: stub endpoints return 501.  
**DoD:** Routes render; CI passes; stubs callable.

### M1 – Data Models & Migrations (0.5–1 day)
- Implement DB migrations/collections and repos for POS entities.  
- Seed demo tenant/location/products/stock.  
**DoD:** Migrations + seed run; repo tests green.

### M2 – Product Search API + Vue UI (1 day)
- Build `GET /pos/products/search` (filters + pagination).  
- `ProductSearch.vue` with Composition API and debounced query; emit `add(product)` to parent.  
**DoD:** Typing shows results; add-to-cart works; API tests for filters/pagination; component unit tests.

### M3 – Cart Math, Discounts, Tax (1 day)
- `POST /pos/cart/price` (round half-up).  
- `Cart.vue` + `CartLine.vue` + `CartSummary.vue`.  
- Pinia cart store drives pricing; recompute on each mutation.  
**DoD:** Unit tests for pricing/rounding; E2E totals match.

### M4 – Shifts (open/close + guard) (0.5 day)
- `POST /pos/shifts/open|close`, `GET /pos/shifts/active`.  
- `ShiftBanner.vue` prompts to open; register page blocks checkout if none.  
**DoD:** 412 from checkout without shift; banner UX validated.

### M5 – Checkout (Cash) with Idempotency (1 day)
- `POST /pos/checkout/cash` uses `Idempotency-Key` (cartToken).  
- `CheckoutCashDialog.vue`: quick buttons (Exact, +1/5/10/20), manual input; shows change.  
**DoD:** E2E happy path: sale persisted, change due displayed, cart cleared.

### M6 – Finalize + Inventory Ledger (atomic) (1 day)
- Transactional finalize; enforce no negative stock; optimistic concurrency retry.  
**DoD:** Race test with two parallel checkouts on last unit → one wins, one 409.

### M7 – Receipts (PDF + email) (1 day)
- Server: PDF generation + email send; client: download + email input.  
**DoD:** Snapshot for PDF; mocked mailer; manual download verified.

### M8 – Z Report + CSV (0.5–1 day)
- Server aggregates; client table and CSV export.  
**DoD:** Z totals reconcile with seed; CSV correctness test.

### M9 – Hardening & Polishing (0.5–1 day)
- RBAC for discounts; a11y; empty/error/loading states.  
- Observability fields on finalize path.  
**DoD:** Authorization tests; a11y smoke; logs contain `saleId/tenantId/locationId/shiftId`.

---

## 6) Test Plan

**Front end (Vitest + VTU)**
- `ProductSearch.vue` debounce & pagination logic.  
- `Cart` pricing reactivity and discount edge cases.  
- `CheckoutCashDialog.vue` change due calculations.

**API**
- Search filters; pagination.  
- Idempotency behavior on checkout.  
- 412 (no shift), 409 (out of stock), 403 (tenant/location violation).

**E2E (Playwright)**
- Full happy path: search → add → discount → cash → receipt → inventory → Z report.  
- Concurrency: two sessions attempting to buy last unit.

---

## 7) Seed & Demo

- Seed 8–12 SKUs with stock per location.  
- Script to open a shift and perform 2–3 demo sales.  
- Demo follows the Success Criteria.

---

## 8) Observability & Security (unchanged)

- Log keys and counters as in the prior plan.  
- RBAC for discounting; no PII in logs.

---

## 9) Cursor Prompts (Vue-flavored)

> Paste these into Cursor one milestone at a time. Prefer **tests first**.

### P0 — Vue routes & placeholders
```text
You are GPT-5 Thinking inside Cursor. In the Catalog Vue app, add POS routes:
- /pos/register, /pos/report, /pos/settings (Vue Router)
Create placeholder SFCs:
- views/pos/PosRegisterPage.vue
- views/pos/ZReportPage.vue
- views/pos/LocationSettingsPage.vue
Create components:
- components/pos/ProductSearch.vue
- components/pos/Cart.vue, components/pos/CartLine.vue, components/pos/CartSummary.vue
- components/pos/CheckoutCashDialog.vue
- components/pos/ShiftBanner.vue

Add a feature-flagged nav item for POS. Write simple render tests for the routes using Vitest + Vue Test Utils.
```

### P1 — Pinia stores
```text
Create Pinia stores:
- stores/pos/cart.ts (lines, pricing, cartToken; actions add/update/remove/priceCart)
- stores/pos/shift.ts (activeShift; open/close/fetch)
- stores/pos/settings.ts (taxRate, receiptFooter, canDiscount; loadSettings)

Write unit tests for store actions and reactivity.
```

### P2 — Product search API + UI
```text
Backend: implement GET /pos/products/search with q, brand, category, sku and pagination. Enforce tenant/location scoping.

Front end: ProductSearch.vue with Composition API, 300ms debounce, emits add(product). Integrate into PosRegisterPage.vue and Pinia cart store.

Tests:
- API: filtering & pagination
- Component: debounce (fake timers), pagination UI
```

### P3 — Pricing engine
```text
Backend: POST /pos/cart/price returns pricedLines + totals with round half-up tax based on location.

Front end: wire Cart components to call price endpoint on mutation (debounced/batched).

Tests:
- Unit: price combos (percent/amount discounts), rounding behavior
- E2E: totals match for known cases
```

### P4 — Shifts
```text
Backend: POST /pos/shifts/open|close, GET /pos/shifts/active.

Front end: ShiftBanner.vue blocks checkout; show open/close actions.

Tests:
- API: only one active shift per tenant+location
- E2E: checkout without shift → 412 + banner
```

### P5 — Checkout (cash) + idempotency
```text
Backend: POST /pos/checkout/cash with Idempotency-Key (cartToken). Return saleId, total, amountReceived, changeDue.

Front end: CheckoutCashDialog.vue (quick buttons: Exact, +1/5/10/20), manual entry, confirm finalize; success clears cart.

Tests:
- API: idempotency returns same sale
- E2E: happy path cash checkout
```

### P6 — Finalize + Inventory ledger
```text
Backend: transactional finalize; write sale, sale_lines, payment, inventory_ledger; enforce non-negative stock; on conflict return 409.

Tests:
- Concurrency race: two buyers for last unit → one succeeds, one 409
- Ledger invariants
```

### P7 — Receipts (PDF + email)
```text
Backend: PDF renderer (lines, totals, tax, change); email via existing mailer.

Front end: post-checkout receipt panel (email field + Download PDF).

Tests: snapshot compare PDF; mock mailer send.
```

### P8 — Z report + CSV
```text
Backend: aggregation by date/location/shift; CSV endpoint.

Front end: ZReportPage with filters and Export CSV button.

Tests: data correctness with seeded sales; CSV structure.
```

### P9 — Hardening
```text
RBAC for discounts; a11y pass; error/loading states; finalize path logs include saleId/tenantId/locationId/shiftId.

Tests: auth for discounting; a11y smoke tests; logger spies.
```

---

## 10) Definition of Done

- All milestones merged; CI green; coverage thresholds met for pricing/checkout modules.  
- Demo script runs cleanly with seed data.  
- Z report reconciles with seed transactions.  
- Security review: tenant/location isolation enforced; no PII in logs.  
- Recorded demo or doc showing search → cart → cash → receipt → inventory → Z report.

---

## 11) Nice-to-haves (v1.1)

- Cash over/short notes on shift close.  
- Per-line tax overrides (tax-exempt items).  
- Returns/voids basic flow.  
- Network receipt printer integration.  
- Draft offline cart (no payments) for resilience.
