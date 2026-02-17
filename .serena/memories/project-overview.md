# Kitchen Odyssey — Project Overview

## Architecture

**Split architecture:** React + Vite frontend → Next.js 16 API backend → MongoDB Atlas

### Frontend (`Kitchen_Odyssey/`)
- **React** 19.2.0 + **Vite** 7.2.4 + **Tailwind CSS** 4.1.18
- **Router:** React Router DOM 7.13.0 (HashRouter)
- **API Client:** `apiClient.js` (fetch wrapper with HttpOnly cookie auth) + `storageApi.js` (drop-in replacement for localStorage-based `storage.js`)
- **All 10 components async-converted** to use `storageApi` instead of synchronous `storage`

### Backend (`kitchen-odyssey-backend/`)
- **Next.js** 16.1.6 (App Router, JavaScript, `src/` directory)
- **MongoDB Atlas** via Mongoose 9.2.1 ODM
- **Auth:** JWT in HttpOnly cookies (`ko_access` 15m, `ko_refresh` 7d), bcryptjs
- **6 Mongoose models:** User, Recipe, Review, SearchHistory, DailyStat, ActivityLog
- **Testing:** Vitest + @vitest/coverage-v8 — **82 tests passing** (8 test files)

## Backend Libraries (`src/lib/`)
- `config.js` — Environment configuration (MongoDB, JWT, CORS, rate limits, image)
- `db.js` — Cached Mongoose connection
- `cors.js` — Origin-validated CORS with credentials
- `response.js` — JSON envelope helpers + `safeErrorResponse`
- `auth.js` — JWT generation, cookie management, `requireAuth`/`requireRole`/`requireActiveUser`
- `rateLimit.js` — In-memory sliding window rate limiter (auth: 20/15min, write: 50/15min, read: 100/15min)
- `validate.js` — `sanitizeString`, `sanitizeQuery` (NoSQL injection defense), schema validators
- `logger.js` — Structured JSON logging with correlation IDs

## API Endpoints (all under `/api/v1/`)
- **Auth:** signup, login, logout, refresh, me, logout-all (6 routes)
- **Recipes:** CRUD + like/favorite/view/reviews/rating/random (12 routes)
- **Users:** list, update profile (2 routes)
- **Admin:** user status, recipe status (2 routes)
- **Other:** daily stats, activity log, search history, image upload (recipe + avatar), health check

## Security
- HttpOnly + SameSite cookies, CORS origin allowlist
- Rate limiting on auth/write endpoints
- Input validation with HTML stripping and NoSQL injection prevention
- Security headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS, Permissions-Policy, X-DNS-Prefetch-Control

## Migration Status
- Phase 1: Planning (ADR-001, readiness checklist, compatibility matrix) DONE
- Phase 2: Backend infrastructure (config, db, cors, response, auth, health) DONE
- Phase 3: Data models + migration/rollback scripts DONE
- Phase 4: All API routes + 49 unit tests DONE
- Phase 5: Frontend integration (apiClient, storageApi, all 10 components async-converted) DONE
- Phase 6: Security & observability (rate limiting, validation, logging, security headers, 33 new tests) DONE
- Phase 7: Azure deployment (excluded per user request) NOT STARTED

## Last Updated
2026-02-18 — Phase 6 complete, 82 tests passing
