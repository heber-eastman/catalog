# Catalog V0 Release Notes (v0.1.0)

## Overview
This release completes Tee Sheet V2 across Phases 1–10:
- Phase 1: Data layer (templates, seasons, overrides) with constraints and hooks
- Phase 2: Validation & compilation services (solar adapter, window compiler, reround cycle detection)
- Phase 3: Generator V2 integrating compiled windows and start-disabled logic
- Phase 4: Cascade apply-now regeneration
- Phase 5: Availability API V2 (visibility rules, per-leg checks, pricing fallback)
- Phase 6: Admin APIs (publish/rollback/archive/delete guards) + cycle detection on publish
- Phase 7: Settings UI V2 (calendar preview, quick actions, DnD a11y)
- Phase 8: Staff/Customer deltas (compare toggle, badges, per-side counts)
- Phase 9: Starters & seeds (demo seeders, starter preset endpoint, UI and test)
- Phase 10: E2E + Smoke verification; release scripts

## Notable APIs
- GET/POST/PATCH under `/tee-sheets/:id/v2/...` for templates, seasons, overrides
- Starter preset: `POST /tee-sheets/:id/v2/starters/preset`
- Availability V2 reflects `is_start_disabled` for staff

## Frontend
- Settings calendar: Today, range regen, side filters (All/None), compare customer, reason badges
- Starter quick action in Settings

## Seeders & Scripts
- Backend seeders for demo course, V2 tee sheet, override, today tee times, geo/tz
- Seed runner: `npm run seed:demo:v2 --workspace=backend` (or root `npm run seed:demo:v2`)
- Release verify: `npm run verify:release`

## Testing
- Backend unit/integration + smoke tests: green
- Frontend unit + Cypress E2E: green

## Upgrade Notes
- Run DB migrations, then demo seeders if desired
- Use Settings UI to manage V2 entities; new endpoints documented above
