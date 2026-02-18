# Kitchen Odyssey Backend

![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)
![Vitest Tests](https://img.shields.io/badge/Tests-87%20Passing-green)
![License](https://img.shields.io/badge/license-MIT-yellow)

API backend for Kitchen Odyssey — built with Next.js 16 App Router, MongoDB Atlas, and comprehensive security features.

## Overview

Kitchen Odyssey Backend provides a RESTful API for the recipe-sharing platform with JWT-based authentication, role-based access control, and real-time analytics. The backend supports secure user management, moderated recipe publication, engagement tracking (likes, favorites, reviews), and comprehensive admin controls.

### Key Features

**Authentication & Security**
- JWT tokens in HttpOnly cookies (access: 15min, refresh: 7d)
- bcrypt password hashing (10 rounds)
- Login validates email format plus non-empty password; password complexity is enforced during signup
- Role-based access control (Admin, Contributor, Guest/Pending)
- In-memory rate limiting (sliding window: auth 20/15min, write 50/15min, read 100/15min)
- Input validation with schema-based sanitization
- CORS origin allowlist with credentials support

**Recipe Management**
- Full CRUD operations for recipes
- Image upload with Sharp processing and thumbnails
- Recipe approval workflow (pending → published/rejected)
- Engagement tracking (likes, favorites, views, reviews)
- Random recipe suggestions with quality filters

**Analytics & Monitoring**
- Daily statistics aggregation (DAU, views, engagement)
- Activity logging for audit trails
- Search history tracking
- Real-time metrics dashboard support

### Tech Stack

- **Next.js 16.1.6** - App Router, API routes, middleware
- **MongoDB Atlas** - Cloud-native NoSQL database
- **Mongoose 9.2.1** - ODM with validation and schema management
- **JWT 9.0.3** - Authentication tokens
- **bcryptjs 3.0.3** - Password hashing
- **Sharp 0.34.5** - Image processing and thumbnails
- **Vitest 4.0.18** - Unit testing with coverage

## Getting Started

### Prerequisites
- Node.js v18 or higher
- MongoDB Atlas account
- npm (included with Node.js)

### Installation

```bash
# Install dependencies
npm install

# Copy env template and configure
cp .env.example .env.local

# Run development server
npm run dev
```

The API serves at `http://localhost:3000/api/v1/`.

### Build for Production

```bash
# Build optimized bundle
npm run build

# Start production server
npm run start
```

### Environment Variables

| Variable | Description | Example |
|---|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://cluster.mongodb.net/kitchen_odyssey` |
| `JWT_SECRET` | Secret for JWT signing | `your-secret-key-min-32-chars` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `http://localhost:5173,https://yourdomain.com` |

> [!WARNING]
> Never commit `.env.local` to version control. Use strong secrets in production.

## API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/signup` | No | Register new user (status: pending) |
| POST | `/api/v1/auth/login` | No | Login with email/password |
| POST | `/api/v1/auth/logout` | Yes | Clear cookies, invalidate session |
| POST | `/api/v1/auth/refresh` | No | Refresh access token |
| GET | `/api/v1/auth/me` | Yes | Get current user profile |
| POST | `/api/v1/auth/logout-all` | Yes | Invalidate all sessions |

### Recipes
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/recipes` | No | List recipes (paginated, supports sort/filter) |
| POST | `/api/v1/recipes` | Yes | Create recipe (author only) |
| GET | `/api/v1/recipes/:id` | No | Get recipe by ID |
| PATCH | `/api/v1/recipes/:id` | Yes | Update recipe (author or admin) |
| DELETE | `/api/v1/recipes/:id` | Yes | Delete recipe (author or admin) |
| POST | `/api/v1/recipes/:id/like` | Yes | Toggle like (active users only) |
| POST | `/api/v1/recipes/:id/favorite` | Yes | Toggle favorite (active users only) |
| POST | `/api/v1/recipes/:id/view` | No | Record view (author/active only) |
| GET | `/api/v1/recipes/:id/reviews` | No | List reviews for recipe |
| POST | `/api/v1/recipes/:id/reviews` | Yes | Add or update review |
| DELETE | `/api/v1/reviews/:id` | Yes | Delete review (owner or admin) |
| GET | `/api/v1/recipes/:id/rating` | No | Get average rating for recipe |
| GET | `/api/v1/recipes/random-suggestion` | No | Get random recipe (quality-based) |

### Users
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/users` | Yes | List users (admin only) |
| PATCH | `/api/v1/users/:id` | Yes | Update user profile (owner or admin) |

### Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| PATCH | `/api/v1/admin/users/:id/status` | Yes | Update user status (admin only) |
| PATCH | `/api/v1/admin/recipes/:id/status` | Yes | Update recipe status (admin only) |

### Other
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/stats/daily` | Yes | Daily statistics (admin only) |
| GET | `/api/v1/activity` | Yes | Activity log (admin only) |
| GET | `/api/v1/search-history` | Yes | Search history (user's own) |
| POST | `/api/v1/search-history` | Yes | Record search query |
| POST | `/api/v1/upload/recipe-image` | Yes | Upload recipe image |
| POST | `/api/v1/upload/user-avatar` | Yes | Upload user avatar |
| DELETE | `/api/v1/upload/image/:path*` | Yes | Delete uploaded image (admin only) |
| GET | `/api/v1/health` | No | Health check endpoint |

> [!NOTE]
- **Auth**: `No` = public, `Yes` = requires valid access token (`Authorization: Bearer <token>`) unless using HttpOnly cookies.
- See [docs/openapi.yaml](docs/openapi.yaml) for complete API specification with request/response schemas.

## Documentation

- [OpenAPI Specification](docs/openapi.yaml) — Complete API contract with request/response schemas
- [SETUP_GUIDE.md](../SETUP_GUIDE.md) — MongoDB Atlas setup and environment configuration
- [Frontend README](../Kitchen_Odyssey/README.md) — Frontend documentation and design system

### Query Behavior

- `GET /api/v1/recipes?sort=trending` sorts by computed like count and recency
- `GET /api/v1/recipes?sort=rating` sorts by computed average rating, review count, likes, and recency
- Filters support: `category`, `difficulty`, `author`, `status` (admin only)

## Security

**Authentication & Authorization**
- HttpOnly + SameSite cookies for JWT tokens
- Access token: 15 minutes, Refresh token: 7 days
- bcrypt password hashing (10 rounds)
- Role-based access control on protected routes

**Rate Limiting (in-memory sliding window)**
| Type | Limit | Window |
|------|-------|--------|
| Auth endpoints | 20 requests | 15 minutes |
| Write operations | 50 requests | 15 minutes |
| Read operations | 100 requests | 15 minutes |

**Input Validation**
- Schema-based validation with Mongoose
- HTML stripping from user inputs
- NoSQL injection prevention
- Length limits on string fields

**Security Headers**
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin
- Strict-Transport-Security (HSTS)
- Permissions-Policy

**CORS**
- Origin allowlist with credentials support
- `Access-Control-Allow-Origin` only for approved origins
- `Vary: Origin` header set correctly

**File Deletion**
- `DELETE /api/v1/upload/image/:path*` is admin-only
- Path traversal protection
- Authorization check before deletion

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode (auto-rerun on changes)
npm run test:coverage # With coverage report
```

**Test Coverage: 87 tests**
- Authentication flows (signup, login, logout, refresh)
- Recipe CRUD operations
- Engagement features (likes, favorites, reviews)
- Admin endpoints and authorization
- Rate limiting and security
- Input validation and error handling

## Project Structure

```
kitchen-odyssey-backend/
├── src/
│   ├── app/api/v1/       # API route handlers
│   │   ├── auth/        # Authentication endpoints
│   │   ├── recipes/      # Recipe CRUD operations
│   │   ├── users/       # User management
│   │   ├── admin/       # Admin-only endpoints
│   │   └── ...         # Other endpoints
│   ├── lib/              # Shared utilities
│   │   ├── auth.js       # JWT + middleware
│   │   ├── config.js     # Environment config
│   │   ├── cors.js       # CORS handling
│   │   ├── db.js         # MongoDB connection
│   │   ├── logger.js     # Structured logging
│   │   ├── rateLimit.js  # Rate limiting
│   │   ├── response.js   # Response helpers
│   │   └── validate.js   # Input validation
│   ├── models/           # Mongoose schemas
│   │   ├── User.js       # User model
│   │   ├── Recipe.js     # Recipe model
│   │   └── ...
│   └── scripts/          # Database seed scripts
├── docs/
│   └── openapi.yaml      # API contract specification
├── tests/                # Vitest test files
├── uploads/              # Local filesystem storage
└── public/               # Static assets
```

## Development

### Creating New API Routes

```javascript
// src/app/api/v1/resource/route.js
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { validateBody } from '@/lib/validate';

export async function GET(req) {
  const user = await requireAuth(req); // Check auth
  // ... implementation
  return NextResponse.json(data);
}

export async function POST(req) {
  const user = await requireAuth(req);
  const body = await validateBody(req, schema); // Validate input
  // ... implementation
  return NextResponse.json(data, { status: 201 });
}
```

### Adding New Models

```javascript
// src/models/NewModel.js
import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  fields: { type: String, required: true }
}, { timestamps: true });

export default mongoose.models.NewModel || mongoose.model('NewModel', schema);
```

## Troubleshooting

**MongoDB Connection Issues (Too Many Connections)**
- **Symptom**: Atlas shows 500+ active connections, cluster becomes slow/unresponsive
- **Root Cause**: Orphaned Node.js processes or excessive connection pool size
- **Fix**: Kill orphaned Node processes and reduce pool size

  ```bash
  # Kill orphaned Node processes (Windows PowerShell)
  Get-Process node | ForEach-Object { Stop-Process -Id $_.Id -Force }

  # Set lower pool size in .env.local
  MONGODB_MAX_POOL_SIZE=5
  MONGODB_MIN_POOL_SIZE=1

  MONGODB_SOCKET_TIMEOUT_MS=45000
  MONGODB_CONNECT_TIMEOUT_MS=10000
  ```

- **Monitoring**: Use `/api/v1/monitoring` endpoint (admin only) to check connection stats
- **Atlas Layer**: Enable "Serverless" or reduce cluster size if not needed

**MongoDB Connection Failed**
- Verify `MONGODB_URI` in `.env.local`
- Check IP whitelist in MongoDB Atlas (allow `0.0.0.0/0` for development)
- Ensure user has read/write permissions on database
- Restart Next.js server after changing `.env.local`

**JWT Invalid/Expired**
- Check `JWT_SECRET` is consistent across restarts
- Verify token expiration times (access: 15m, refresh: 7d)
- Clear browser cookies if switching between dev/staging

**Rate Limiting Issues**
- Adjust limits in `src/lib/rateLimit.js`
- Use production-readyRedis store for distributed deployments

**File Upload Failures**
- Ensure `uploads/` directory exists and is writable
- Check Sharp installation: `npm install --save-dev sharp`
- Verify file size limits (max: 5MB configured)

## Deployment

**Environment Variables Required:**
- `MONGODB_URI` - Production Atlas connection string
- `JWT_SECRET` - Strong secret (32+ characters recommended)
- `ALLOWED_ORIGINS` - Comma-separated production origins

**Recommended Build Steps:**
```bash
npm run build
npm run start
```

**Deployment Targets:**
- Vercel (recommended for Next.js)
- Railway, Render, or other Node.js hosting
- Azure App Service with Node.js runtime
