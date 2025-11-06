
# Catalog POS & Inventory v1 — Cursor Project Plan (Vue, Single‑SKU, Per‑Course Inventory)

**Audience:** Cursor + GPT‑5 Thinking  
**Modules:** **POS** (sell products) and **Inventory** (add/manage products) as separate top‑level nav items.  
**Scope:** Cash‑only POS with search (no barcode), per‑course inventory (no cross‑course stock), single‑SKU products (no variants), receipts (email/PDF), Z report, simple product & stock management.  
**Assumptions:** Catalog is multi‑tenant; a **course** is the operational context. One tenant can own multiple courses. Inventory, products, sales, and shifts are **scoped to a single course**; optional sub‑locations (e.g., “Pro Shop”, “Grill”) exist within a course.

---

## 0) Success Criteria

- **POS**: Search by name/SKU/brand/category; build cart; discounts/tax; **cash** checkout with change due; requires open shift; receipt (email/PDF); inventory decremented atomically.  
- **Inventory**: Create/edit products (name, SKU, price, brand, category, tax‑exempt, active); see on‑hand per **course(+location)**; post adjustments (receive/write‑off/correction).  
- **Reporting**: Daily Z report by course (+location/shift), CSV export; figures reconcile to sales.  
- **Isolation**: All reads/writes constrained by `tenantId` and **`courseId`** (and optional `locationId`). No cross‑course operations.  
- **Quality**: Unit/API/E2E tests; structured logs/metrics; RBAC for discounts & inventory adjustments.

---

## 1) Architecture (Vue‑focused)

- **Front end:** Vue 3 (Composition API) + Vue Router + Pinia + Vite; Tailwind or existing DS.  
- **Back end:** Existing Catalog API (Node/TS assumed).  
- **Testing:** Vitest + Vue Test Utils; Playwright for E2E.  
- **Auth/Context:** Session provides `tenantId`, **`courseId`**, optional `locationId`. Middleware injects into `req.context`.  
- **Observability:** Log `saleId`, `tenantId`, `courseId`, `locationId`, `shiftId`, `requestId`; timers for pricing/finalize.

---

## 2) Data Model (single‑SKU, per‑course)

> Tables/collections below are **scoped to (tenant, course)**. Uniqueness and queries include these keys.

### Core
- **Product**: `id, tenantId, courseId, name, sku (unique in tenant+course), brand, category, priceCents, taxExempt:boolean, active:boolean, createdAt, updatedAt`
- **InventoryLevel** (materialized stock): `tenantId, courseId, locationId, productId, onHand` (PK: tenantId+courseId+locationId+productId)
- **InventoryLedger** (source of truth): `id, tenantId, courseId, locationId, productId, delta, reason('sale'|'refund'|'receive'|'writeoff'|'correction'), refId?, note?, createdAt`
- **RegisterShift**: `id, tenantId, courseId, locationId, openedBy, openedAt, closedAt, openingNote?, closingNote?, totalsJson`
- **Sale**: `id, tenantId, courseId, locationId, shiftId, status('open'|'paid'|'void'), subtotalCents, discountTotalCents, taxTotalCents, tipCents=0, totalCents, paidCashCents, changeDueCents, createdAt`
- **SaleLine**: `id, saleId, productId, sku, qty>0, unitPriceCents, discountValueCents, discountType('amount'|'percent')?, taxAppliedCents, lineTotalCents`
- **Payment**: `id, saleId, method='cash', amountCents, createdAt`

**Invariants**
- Finalize sale writes **Sale, SaleLines, Payment, InventoryLedger** in a single transaction; **no negative stock**.  
- Product `(tenantId, courseId, sku)` is unique.  
- All queries filter by `tenantId` + `courseId` (and `locationId` where relevant).

---

## 3) API Contracts (OpenAPI‑style)

### POS
- `GET /pos/products/search?courseId=&q=&brand=&category=&sku=&page=&pageSize=` → `{ items, page, pageSize, total }` (filters `active=true`)
- `POST /pos/cart/price` → Body `{ courseId, locationId, lines:[{productId, qty, discount?}] }` → totals
- `POST /pos/shifts/open` → `{ courseId, locationId, note? }`
- `POST /pos/shifts/close` → `{ shiftId, note? }`
- `GET /pos/shifts/active?courseId=&locationId=` → active shift or null
- `POST /pos/checkout/cash` (Idempotency‑Key: cartToken)  
  Body `{ courseId, locationId, shiftId, lines[...], amountReceivedCents, emailReceipt? }`  
  Returns `{ saleId, totalCents, amountReceivedCents, changeDueCents }`
- `GET /pos/report/z?courseId=&date=YYYY-MM-DD&locationId=&shiftId=` → base totals; `/pos/report/z.csv`

**Errors:** `412` (no shift), `409` (out of stock), `403` (scope), `400` (validation).

### Inventory
- `GET /inventory/products?courseId=&query=&brand=&category=&active=&page=&pageSize=`
- `POST /inventory/products` (create)  
- `GET /inventory/products/:id`
- `PUT /inventory/products/:id` (edit fields)  
- `GET /inventory/levels?courseId=&locationId=&productId=&page=&pageSize=` → levels
- `POST /inventory/adjustments`  
  Body `{ courseId, locationId, productId, delta, reason:'receive'|'writeoff'|'correction', note? }`  
  Effect: write **InventoryLedger** (+ update **InventoryLevel**); return new `onHand`.

**RBAC**  
- `pos:discount` for %/$ discounts in POS.  
- `inventory:write` for product create/update.  
- `inventory:adjust` for stock adjustments.

---

## 4) Vue Navigation & Screens

### Top‑level nav
- **POS** → `/pos/register`, `/pos/report`, `/pos/settings`
- **Inventory** → `/inventory/products`, `/inventory/products/new`, `/inventory/products/:id`, `/inventory/stock`

### POS pages/components
- `views/pos/PosRegisterPage.vue`  
- `views/pos/ZReportPage.vue`  
- `views/pos/LocationSettingsPage.vue`  
- `components/pos/ProductSearch.vue` (debounced)  
- `components/pos/Cart.vue` / `CartLine.vue` / `CartSummary.vue`  
- `components/pos/CheckoutCashDialog.vue`  
- `components/pos/ShiftBanner.vue`

### Inventory pages/components
- `views/inventory/ProductsListPage.vue` (search/filter/paginate; “New”)  
- `views/inventory/ProductFormPage.vue` (create/edit)  
- `views/inventory/InventoryPage.vue` (levels table with course+location filters)  
- `components/inventory/AdjustStockDialog.vue`

### Pinia stores
- `stores/pos/cart.ts` — `lines, cartToken, pricing`; actions `addLine/updateQty/removeLine/applyDiscount/priceCart`
- `stores/pos/shift.ts` — `activeShift`; actions `open/close/fetch`
- `stores/pos/settings.ts` — `taxRate, receiptFooter, canDiscount`
- `stores/products.ts` — list/get/create/update
- `stores/inventory.ts` — fetchLevels, adjust

---

## 5) Pricing/Tax Rules (v1)

- Flat **course‑level** tax rate used unless item is `taxExempt`.  
- Rounding: **half‑up to cents**.  
- Discount precedence: line‑level first, then cart‑level; tax computed on discounted price.

---

## 6) Migrations (SQL‑ish)

```sql
CREATE TABLE product (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  course_id UUID NOT NULL,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  tax_exempt BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX product_sku_unique ON product(tenant_id, course_id, sku);

CREATE TABLE inventory_level (
  tenant_id UUID NOT NULL,
  course_id UUID NOT NULL,
  location_id UUID NOT NULL,
  product_id UUID NOT NULL,
  on_hand INT NOT NULL,
  PRIMARY KEY (tenant_id, course_id, location_id, product_id)
);

CREATE TABLE inventory_ledger (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  course_id UUID NOT NULL,
  location_id UUID NOT NULL,
  product_id UUID NOT NULL,
  delta INT NOT NULL,
  reason TEXT CHECK (reason IN ('sale','refund','receive','writeoff','correction')) NOT NULL,
  ref_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sale / SaleLine / Payment identical to prior plan but include course_id
```

---

## 7) Milestones & Tasks (PR‑sized)

### POS Track
- **P0 — Bootstrap POS** (0.5–1d): routes, placeholders, API stubs (501).  
- **P1 — Models & Migrations (POS subset)** (0.5–1d): Sale, SaleLine, Payment, RegisterShift, InventoryLedger (shared).  
- **P2 — Product search (POS)** (1d): `/pos/products/search` + `ProductSearch.vue`.  
- **P3 — Cart & Pricing** (1d): `/pos/cart/price`; Cart components; rounding rules.  
- **P4 — Shifts** (0.5d): open/close/active + `ShiftBanner.vue`.  
- **P5 — Cash Checkout** (1d): `/pos/checkout/cash` (idempotent); `CheckoutCashDialog.vue`.  
- **P6 — Finalize + Inventory write** (1d): atomic commit; non‑negative stock; conflict 409.  
- **P7 — Receipts** (1d): PDF + email.  
- **P8 — Z Report** (0.5–1d): aggregates + CSV.  
- **P9 — Hardening** (0.5–1d): RBAC for discounts; logs; a11y; tests.

### Inventory Track (can run parallel after P1)
- **I0 — Bootstrap Inventory** (0.5d): routes, placeholders.  
- **I1 — Product CRUD** (1–1.5d): list/search/create/edit with validation, SKU uniqueness; RBAC.  
- **I2 — Inventory Levels & Adjustments** (1d): levels query; adjustments endpoint + dialog; updates ledger + level.  
- **I3 — POS Integration Hooks** (0.5d): POS search filters `active=true`; invalidate caches; E2E “create product → sell in POS”.  
- **I4 — Hardening** (0.5d): audit logs on adjustments; empty/error states; a11y.

_Total initial delivery: ~7–9 dev‑days POS + ~3–4 dev‑days Inventory (parallelizable)._

---

## 8) Test Plan (representative)

**Unit**: pricing math, discount precedence, rounding; product validation; ledger invariants.  
**API**: scoping to tenant+course; 412 (no shift), 409 (out of stock), 403 (RBAC/scope), SKU uniqueness 409; adjustment math.  
**E2E**:  
1) POS happy path (course‑scoped) → search → add → discount → cash → receipt → stock decremented.  
2) Inventory → create product (course X) → visible in POS for course X; **not** visible for course Y.  
3) Adjustment “receive +10” increases onHand at selected location; POS can then sell.  
4) Concurrency on last unit: one succeeds, one 409.

---

## 9) Cursor Prompts (Vue‑flavored)

### CP‑POS‑Bootstrap
```text
Add POS routes (/pos/register, /pos/report, /pos/settings) and placeholder SFCs.
Create server stubs for POS APIs returning 501.
Inject tenantId, courseId, locationId into req.context via middleware.
Write route render tests (Vitest + VTU).
```

### CP‑Inventory‑Bootstrap
```text
Add Inventory routes (/inventory/products, /inventory/products/new, /inventory/products/:id, /inventory/stock) and placeholder SFCs.
Create stubs for Inventory APIs returning 501.
Render tests for pages.
```

### CP‑Models‑Migrations
```text
Create tables/collections for Product, InventoryLevel, InventoryLedger, RegisterShift, Sale, SaleLine, Payment.
Ensure all include tenantId and courseId. Uniqueness: (tenantId, courseId, sku).
Add repositories with scope guards.
Tests: migration up/down; repo CRUD with scoping.
```

### CP‑Product‑CRUD
```text
Implement Inventory APIs: list/get/create/update products (validation: name, sku, price>=0; unique sku per course).
Vue: ProductsListPage.vue and ProductFormPage.vue with vee-validate + zod.
Pinia: stores/products.ts list/get/create/update.
Tests: API validation/scope/uniqueness; component submit flows.
```

### CP‑Inventory‑Levels‑Adjust
```text
Implement GET /inventory/levels and POST /inventory/adjustments (write ledger + level; return new onHand).
Vue: InventoryPage.vue + AdjustStockDialog.vue.
Pinia: stores/inventory.ts fetchLevels, adjust.
Tests: math, permissions, negative guard (unless writeoff).
```

### CP‑POS‑Search‑Cart‑Price
```text
Implement GET /pos/products/search (filters: active=true, q, brand, category, sku) scoped to course.
Implement POST /pos/cart/price with rounding half-up; tax from course settings; taxExempt supported.
Vue: ProductSearch.vue + Cart components and Pinia store.
Tests: API filter/pagination; pricing edge cases.
```

### CP‑POS‑Shifts‑Checkout
```text
Implement shifts open/close/active; enforce checkout requires active shift.
Implement POST /pos/checkout/cash with Idempotency-Key based on cartToken.
Vue: ShiftBanner.vue and CheckoutCashDialog.vue.
Tests: 412 guard; idempotency; change-due calc.
```

### CP‑POS‑Finalize‑Receipts‑Report
```text
Atomic finalize writes sale, lines, payment, ledger; conflict -> 409. Generate receipt PDF + email.
Implement GET /pos/report/z and /pos/report/z.csv (by course, optional location/shift).
Tests: race test on last unit; receipt snapshot; Z totals match seed.
```

### CP‑Hardening
```text
RBAC: pos:discount, inventory:write, inventory:adjust. Add structured logs on finalize and adjustments.
A11y + empty/error states. Ensure no cross-course leakage in queries.
Tests: auth checks; log fields present; E2E "create → receive → sell".
```

---

## 10) Definition of Done

- POS and Inventory modules visible in top‑level nav; all routes live.  
- Course‑scoped data enforced; creating products/stock in one course never surfaces in another.  
- POS cash sale flow completes with receipt; inventory decrements atomically.  
- Inventory adjustments update levels and reflect in POS.  
- Z report reconciles with sample sales.  
- CI green; tests passing; demo script recorded.

---

## 11) Nice‑to‑Haves (v1.1)

- Cash over/short notes & summary at shift close.  
- Per‑line tax overrides (tax‑exempt items).  
- Returns/voids.  
- Network receipt printer.  
- Bulk product import (CSV).  
- Audit UI for ledger entries.
