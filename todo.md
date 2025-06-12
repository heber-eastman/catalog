## 1. Monorepo & CI Setup

- [x]  Initialize Git repository with `backend/` and `frontend/` directories
- [x]  Create root `package.json` declaring npm workspaces for `backend` and `frontend`
- [x]  In `backend/`, initialize npm project
- [x]  Install backend dependencies: express, sequelize, pg, dotenv, jsonwebtoken, aws-sdk, joi, bcrypt
- [x]  In `frontend/`, initialize Vite project for Vue 3 with Vuetify
- [x]  Add ESLint and Prettier configuration at project root
- [x]  Create `.github/workflows/ci.yml` with lint and placeholder test jobs
- [x]  Write Jest tests:
    - [x]  Lint script fails on deliberate lint error
    - [x]  `npm test` runs and passes with no tests
- [x]  Verify CI pipeline runs and passes

## 2. Sequelize & Migrations

- [ ]  Install Sequelize CLI, `pg`, `dotenv` in `backend/`
- [ ]  Create `config/database.js` to load `DATABASE_URL` from `.env`
- [ ]  Write migration `XXXX-create-golfcourseinstance.js` with table and columns:
    - id, name, street, city, state, postal_code, country, subdomain (unique), primary_admin_id, status (enum), date_created
- [ ]  Add index on `status`
- [ ]  Write migration `XXXX-create-superadminuser.js`
- [ ]  Write migration to add `course_id` to `StaffUsers` and create `StaffUsers` table if needed
- [ ]  Write migration `XXXX-create-customer.js`
- [ ]  Write migration `XXXX-create-customernotes.js`
- [ ]  Write Jest integration test: run all migrations against SQLite in-memory and verify table schemas

## 3. JWT Auth & Token Utilities

- [ ]  Create `backend/src/auth/jwt.js`: `signToken`, `verifyToken` using `JWT_SECRET`
- [ ]  Create `backend/src/lib/tokenUtil.js`: `generateTokenString`, `isTokenExpired`
- [ ]  Write Jest tests for JWT sign/verify and token expiry functions

## 4. Signup Endpoint & Subdomain Collision

- [ ]  Implement `POST /api/v1/signup` in Express:
    - [ ]  Validate request body with Joi
    - [ ]  Slugify course name to subdomain, handle collisions by appending `2`, `3`, …
    - [ ]  Create `GolfCourseInstance` with `status=Pending`
    - [ ]  Create `StaffUser` with `is_active=false`, hashed password, invitation token fields
    - [ ]  Send confirmation email via SES (mock in tests)
    - [ ]  Return `201 Created` with subdomain and message
- [ ]  Write supertest tests for:
    - Successful signup
    - Subdomain collision handling
    - Validation errors

## 5. Confirmation Endpoint & Auto-Login

- [ ]  Implement `GET /api/v1/confirm` in Express:
    - [ ]  Read token query parameter
    - [ ]  Verify invitation token and expiry
    - [ ]  Activate course and staff user, clear token fields
    - [ ]  Issue JWT cookie, redirect to dashboard on subdomain
- [ ]  Write supertest tests for valid, expired, and invalid tokens

## 6. Customer CRUD & Scoping

- [ ]  Scaffold `routes/customers.js` and mount at `/api/v1/customers`
- [ ]  Middleware to verify JWT, enforce `role ∈ {Admin,Manager,Staff}`, extract `course_id`
- [ ]  Implement:
    - `GET /customers` with search, filter, sort, pagination
    - `POST /customers` to create new customer
    - `GET /customers/:id` to retrieve
    - `PUT /customers/:id` to update
    - `DELETE /customers/:id` to soft-archive
- [ ]  Write Jest + supertest tests for:
    - Tenant isolation
    - Validation of fields
    - Filtering, sorting, pagination

## 7. CSV Import/Export & Notes

- [ ]  Extend `routes/customers.js`:
    - `POST /customers/import` for CSV import, upsert, error collection
    - `GET /customers/export` for CSV export of `name,email,phone`
- [ ]  Scaffold `routes/notes.js`:
    - `GET /customers/:cid/notes`
    - `POST /customers/:cid/notes`
    - `PUT /customers/:cid/notes/:id`
    - `DELETE /customers/:cid/notes/:id`
- [ ]  Write integration tests for import/export and notes CRUD with permission checks

## 8. Staff & Super-Admin Backend

- [ ]  Create `routes/staff.js` with endpoints:
    - `GET /staff`
    - `POST /staff/invite`
    - `POST /staff/register`
    - `POST /staff/resend-invite`
    - `POST /staff/revoke-invite`
    - `PUT /staff/:id`
    - `DELETE /staff/:id`
- [ ]  Create `routes/super-admins.js` with endpoints:
    - `GET /courses`
    - `POST /courses`
    - `PUT /courses/:id`
    - `PATCH /courses/:id/status`
    - `GET /super-admins`
    - `POST /super-admins/invite`
    - `POST /super-admins/register`
    - `POST /super-admins/resend-invite`
    - `POST /super-admins/revoke-invite`
    - `PUT /super-admins/:id`
    - `DELETE /super-admins/:id`
- [ ]  Write tests to verify role enforcement and happy/error paths

## 9. Frontend Shell & Auth

- [x]  Scaffold Vue3 + Vuetify via Vite in `frontend/`
- [x]  Install Axios, create basic Vue app structure
- [x]  Configure Vue Router with routes:
    - [x]  Basic routing structure (Home, About)
    - [ ]  `/signup`, `/confirm`, `/login`
    - [ ]  `/customers`, `/customers/:id`
    - [ ]  `/staff`, `/staff/register`
    - [ ]  `/super-admin/courses`, `/super-admin/super-admins`, `/super-admin/register`
- [x]  Create basic page templates (Home, About views)
- [x]  Set up Vuetify theming and layout structure
- [ ]  Create `services/api.js` with JWT interceptor
- [ ]  Write Cypress tests for signup, confirm, login flows

## 10. Feature UIs & E2E

- [ ]  Implement `CustomersList.vue`, `CustomerProfile.vue`, import/export modals
- [ ]  Implement `StaffList.vue`, invite/edit/deactivate UI
- [ ]  Implement `CoursesList.vue`, add/edit/status UI
- [ ]  Implement `SuperAdminsList.vue`, invite/edit/deactivate/resend/revoke UI
- [ ]  Implement `StatusCard.vue` for dashboard counts
- [ ]  Write Vue Test Utils unit tests and Cypress E2E scenarios

## 11. Routing, Reporting & Infra

- [ ]  Add Express middleware to map `Host` header `subdomain.devstreet.co` → `req.course_id`
- [ ]  Implement `GET /api/v1/customers/status-counts` and write tests
- [ ]  Configure wildcard DNS `.devstreet.co` pointing to ALB
- [ ]  Add rate-limit middleware (60 rpm, burst 10) and write tests
- [ ]  Implement GDPR purge scheduler with tests

## 12. Final Polish & Deployment

- [x]  Update `README.md` with setup, env vars, and deploy steps
- [x]  Enhance CI to build frontend, run backend tests
- [ ]  Create smoke tests in staging: signup → dashboard → core functionalities
- [ ]  Configure SES in production and verify email flows
- [ ]  Verify CloudWatch alarms and SNS notifications
- [ ]  Push Docker, deploy ECS

---

## 📊 Progress Summary

**✅ Section 1: Monorepo & CI Setup** - **COMPLETE** (100%)
- Full monorepo structure with npm workspaces
- Express.js backend with all required dependencies
- Vue 3 + Vuetify frontend with Vite
- ESLint + Prettier code quality setup
- GitHub Actions CI/CD pipeline
- Comprehensive testing framework

**🔄 Section 9: Frontend Shell & Auth** - **IN PROGRESS** (60%)
- Basic Vue application structure ✅
- Vuetify integration and theming ✅
- Basic routing and page templates ✅
- API service layer and auth flows pending

**📋 Next Priority**: Section 2 (Sequelize & Migrations) to set up the database layer
