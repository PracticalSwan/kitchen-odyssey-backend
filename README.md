# Kitchen Odyssey Backend

API backend for Kitchen Odyssey — built with Next.js 16 App Router and MongoDB Atlas.

## Tech Stack

- **Runtime:** Next.js 16.1.6 (App Router, JavaScript)
- **Database:** MongoDB Atlas (Mongoose 9.2.1 ODM)
- **Auth:** JWT in HttpOnly cookies (access 15m, refresh 7d)
- **Images:** Sharp for thumbnails, local filesystem storage
- **Testing:** Vitest + @vitest/coverage-v8 (82 tests)

## Getting Started

```bash
# Install dependencies
npm install

# Copy env template and configure
cp .env.example .env.local

# Run development server
npm run dev
```

The API serves at `http://localhost:3000/api/v1/`.

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Secret for JWT signing | `your-secret-key` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `http://localhost:5173` |

## API Endpoints

### Auth
- `POST /api/v1/auth/signup` — Register new user
- `POST /api/v1/auth/login` — Login with email/password
- `POST /api/v1/auth/logout` — Logout (clear cookies)
- `POST /api/v1/auth/refresh` — Refresh access token
- `GET /api/v1/auth/me` — Get current user
- `POST /api/v1/auth/logout-all` — Invalidate all sessions

### Recipes
- `GET /api/v1/recipes` — List recipes (paginated)
- `POST /api/v1/recipes` — Create recipe (auth required)
- `GET /api/v1/recipes/:id` — Get recipe by ID
- `PATCH /api/v1/recipes/:id` — Update recipe
- `DELETE /api/v1/recipes/:id` — Delete recipe
- `POST /api/v1/recipes/:id/like` — Toggle like
- `POST /api/v1/recipes/:id/favorite` — Toggle favorite
- `POST /api/v1/recipes/:id/view` — Record view
- `GET /api/v1/recipes/:id/reviews` — List reviews
- `POST /api/v1/recipes/:id/reviews` — Add/update review
- `DELETE /api/v1/recipes/:id/reviews/:reviewId` — Delete review
- `GET /api/v1/recipes/:id/rating` — Get average rating
- `GET /api/v1/recipes/random/suggestion` — Random recipe

### Users
- `GET /api/v1/users` — List users
- `PATCH /api/v1/users/:id` — Update user profile

### Admin
- `PATCH /api/v1/admin/users/:id/status` — Update user status
- `PATCH /api/v1/admin/recipes/:id/status` — Update recipe status

### Other
- `GET /api/v1/stats/daily` — Daily statistics
- `GET /api/v1/activity` — Activity log
- `GET /api/v1/search-history` — Search history
- `POST /api/v1/search-history` — Record search
- `POST /api/v1/upload/recipe-image` — Upload recipe image
- `POST /api/v1/upload/user-avatar` — Upload user avatar
- `GET /api/v1/health` — Health check

## Security

- **Rate Limiting:** In-memory sliding window (auth: 20/15min, write: 50/15min, read: 100/15min)
- **Input Validation:** Schema-based sanitization (HTML stripping, length limits, NoSQL injection prevention)
- **Security Headers:** X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS, Permissions-Policy
- **CORS:** Origin allowlist with credentials support
- **Auth:** HttpOnly + SameSite cookies, bcryptjs password hashing

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Project Structure

```
src/
├── app/api/v1/       # API routes
├── lib/              # Shared utilities
│   ├── auth.js       # JWT + middleware
│   ├── config.js     # Environment config
│   ├── cors.js       # CORS handling
│   ├── db.js         # MongoDB connection
│   ├── logger.js     # Structured logging
│   ├── rateLimit.js  # Rate limiting
│   ├── response.js   # Response helpers
│   └── validate.js   # Input validation
├── models/           # Mongoose schemas
tests/                # Vitest test files
```
