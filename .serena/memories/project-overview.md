# Kitchen Odyssey Backend - Project Overview

## Project Identity

**Project Name:** Kitchen Odyssey Backend
**Workspace Location:** `Project2/kitchen-odyssey-backend`
**Type:** Next.js 16.1.6 API server with MongoDB Atlas
**Status:** Project scaffolded, implementation pending explicit approval
**Frontend:** `Project2/Kitchen_Odyssey` (React + Vite)

## Technology Stack

### Backend Framework
- **Next.js:** 16.1.6 (App Router)
- **Language:** JavaScript (NOT TypeScript)
- **Directory Structure:** `src/` enabled
- **Runtime:** Node.js (not Edge)

### Database
- **MongoDB:** Atlas (cloud-hosted)
- **ODM:** Mongoose 9.0.1
- **Connection:** Cached promise pattern for connection pooling

### API Architecture
- **Versioning:** `/api/v1/*`
- **Format:** RESTful with JSON responses
- **Authentication:** JWT tokens in HttpOnly cookies
- **CORS:** Configured via environment variables

### Deployment Target
- **Primary:** Azure VM with Nginx/Caddy reverse proxy
- **Optional:** Vercel/Railway/Render for QA previews only

## Project Structure

```
kitchen-odyssey-backend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   └── v1/            # API v1 endpoints
│   │   │       ├── auth/      # Authentication endpoints
│   │   │       ├── recipes/   # Recipe CRUD endpoints
│   │   │       ├── users/     # User management endpoints
│   │   │       ├── reviews/   # Review endpoints
│   │   │       └── health/    # Health check endpoint
│   │   └── proxy.js           # Global middleware (Next.js 16)
│   ├── lib/                   # Utility libraries
│   │   ├── config.js          # Environment configuration
│   │   ├── mongodb.js         # Database connection
│   │   └── cors.js            # CORS helper
│   ├── models/                # Mongoose schemas
│   │   ├── User.js
│   │   ├── Recipe.js
│   │   └── Review.js
│   ├── repositories/          # Database access layer
│   │   ├── userRepository.js
│   │   ├── recipeRepository.js
│   │   └── reviewRepository.js
│   └── services/              # Business logic layer
│       ├── authService.js
│       ├── recipeService.js
│       └── reviewService.js
├── public/                    # Static assets
├── .env.example               # Environment template
├── next.config.js             # Next.js configuration
├── package.json               # Dependencies
└── README.md                  # Project documentation
```

## Key Next.js 16 Changes

### Middleware → Proxy
```javascript
// Old (Next.js 15): middleware.js
export function middleware(request) { }

// New (Next.js 16): proxy.js
export function proxy(request) { }
```

**Migration Codemod:**
```bash
npx @next/codemod@latest middleware-to-proxy .
```

### Async Params
```javascript
// Route handlers now receive async params
export async function GET(request, { params }) {
  const { id } = await params  // Must await params
}
```

### Async Headers/Cookies
```javascript
import { headers, cookies } from 'next/headers'

// Now async functions
const headersList = await headers()
const cookiesList = await cookies()
```

### Response Helper
```javascript
// Prefer Response.json() over NextResponse.json()
export async function GET() {
  return Response.json({ data: 'hello' })
}
```

## API Endpoints

### Authentication (`/api/v1/auth`)

#### POST `/api/v1/auth/signup`
**Description:** Register new user
**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "username": "chef123",
  "firstName": "John",
  "lastName": "Doe",
  "birthday": "1990-01-01"
}
```
**Response:** 201 Created
```json
{
  "success": true,
  "user": {
    "id": "123abc",
    "email": "user@example.com",
    "username": "chef123",
    "role": "user",
    "status": "pending"
  }
}
```

#### POST `/api/v1/auth/login`
**Description:** Login with credentials
**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```
**Response:** 200 OK
```json
{
  "success": true,
  "user": {
    "id": "123abc",
    "email": "user@example.com",
    "username": "chef123",
    "role": "user",
    "status": "active"
  }
}
```
**Side Effect:** Sets HttpOnly cookie with JWT token

#### POST `/api/v1/auth/logout`
**Description:** Logout user
**Response:** 200 OK
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```
**Side Effect:** Clears JWT cookie

#### GET `/api/v1/auth/me`
**Description:** Get current user from JWT
**Response:** 200 OK
```json
{
  "success": true,
  "user": {
    "id": "123abc",
    "email": "user@example.com",
    "username": "chef123",
    "role": "user",
    "status": "active"
  }
}
```

### Recipes (`/api/v1/recipes`)

#### GET `/api/v1/recipes`
**Query Params:**
- `status` (optional): `published` | `pending` | `rejected`
- `category` (optional): Filter by category
- `difficulty` (optional): `Easy` | `Medium` | `Hard`
- `author` (optional): Author ID
- `page` (default: 1)
- `limit` (default: 30)

**Response:** 200 OK
```json
{
  "success": true,
  "recipes": [...],
  "pagination": {
    "page": 1,
    "limit": 30,
    "total": 100,
    "totalPages": 4
  }
}
```

#### GET `/api/v1/recipes/:id`
**Response:** 200 OK
```json
{
  "success": true,
  "recipe": {
    "id": "456def",
    "title": "Delicious Pasta",
    "description": "...",
    "category": ["Dinner", "Italian"],
    "difficulty": "Medium",
    "prepTime": 15,
    "cookTime": 30,
    "servings": 4,
    "ingredients": [...],
    "instructions": [...],
    "author": "chef123",
    "authorId": "123abc",
    "status": "published",
    "likedBy": ["123abc", "789ghi"],
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

#### POST `/api/v1/recipes`
**Authentication Required:** Yes
**Request:**
```json
{
  "title": "Delicious Pasta",
  "description": "...",
  "category": ["Dinner"],
  "difficulty": "Medium",
  "prepTime": 15,
  "cookTime": 30,
  "servings": 4,
  "ingredients": [
    { "name": "Pasta", "quantity": "400", "unit": "g" }
  ],
  "instructions": [
    "Boil water",
    "Add pasta",
    "Cook for 10 minutes"
  ],
  "image": "https://example.com/image.jpg"
}
```
**Response:** 201 Created
```json
{
  "success": true,
  "recipe": {...}
}
```

#### PUT `/api/v1/recipes/:id`
**Authentication Required:** Yes (author or admin)
**Response:** 200 OK
```json
{
  "success": true,
  "recipe": {...}
}
```

#### DELETE `/api/v1/recipes/:id`
**Authentication Required:** Yes (author or admin)
**Response:** 200 OK
```json
{
  "success": true,
  "message": "Recipe deleted successfully"
}
```

### Users (`/api/v1/users`)

#### GET `/api/v1/users`
**Authentication Required:** Admin only
**Query Params:**
- `role` (optional): `user` | `admin`
- `status` (optional): `active` | `inactive` | `pending` | `suspended`
- `search` (optional): Search by username or email

**Response:** 200 OK
```json
{
  "success": true,
  "users": [...],
  "pagination": { ... }
}
```

#### GET `/api/v1/users/:id`
**Response:** 200 OK
```json
{
  "success": true,
  "user": {...}
}
```

#### PUT `/api/v1/users/:id`
**Authentication Required:** Yes (self or admin for status)
**Request:**
```json
{
  "firstName": "Jane",
  "bio": "I love cooking!",
  "avatar": "https://example.com/avatar.jpg"
}
```
**Response:** 200 OK
```json
{
  "success": true,
  "user": {...}
}
```

#### PATCH `/api/v1/users/:id/status`
**Authentication Required:** Admin only
**Request:**
```json
{
  "status": "active"
}
```
**Response:** 200 OK
```json
{
  "success": true,
  "user": {...}
}
```

#### DELETE `/api/v1/users/:id`
**Authentication Required:** Admin only
**Response:** 200 OK
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

### Reviews (`/api/v1/reviews`)

#### GET `/api/v1/reviews?recipeId=:id`
**Response:** 200 OK
```json
{
  "success": true,
  "reviews": [...]
}
```

#### POST `/api/v1/reviews`
**Authentication Required:** Yes
**Request:**
```json
{
  "recipeId": "456def",
  "rating": 5,
  "comment": "Amazing recipe!"
}
```
**Response:** 201 Created
```json
{
  "success": true,
  "review": {...}
}
```

#### DELETE `/api/v1/reviews/:id`
**Authentication Required:** Yes (review author or admin)
**Response:** 200 OK
```json
{
  "success": true,
  "message": "Review deleted successfully"
}
```

### Interactions (`/api/v1/interactions`)

#### POST `/api/v1/interactions/like`
**Authentication Required:** Yes
**Request:**
```json
{
  "recipeId": "456def"
}
```
**Response:** 200 OK
```json
{
  "success": true,
  "liked": true
}
```

#### POST `/api/v1/interactions/favorite`
**Authentication Required:** Yes
**Request:**
```json
{
  "recipeId": "456def"
}
```
**Response:** 200 OK
```json
{
  "success": true,
  "favorited": true
}
```

#### POST `/api/v1/interactions/view`
**Request:**
```json
{
  "recipeId": "456def",
  "viewerType": "user"
}
```
**Note:** Bypassed for guest users (called from frontend with checks)

### Health Check (`/api/v1/health`)

#### GET `/api/v1/health`
**Response:** 200 OK
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "database": {
    "status": "connected",
    "name": "kitchen_odyssey"
  }
}
```

## Environment Variables

### Required
```bash
# MongoDB Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/kitchen_odyssey?retryWrites=true&w=majority

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your-secret-key-here

# CORS
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com

# Node Environment
NODE_ENV=production
```

### Optional
```bash
# MongoDB Connection Pooling
MONGODB_MAX_POOL_SIZE=10
MONGODB_MIN_POOL_SIZE=2
MONGODB_SERVER_SELECTION_TIMEOUT_MS=5000

# API Configuration
API_RATE_LIMIT_MAX=100
API_RATE_LIMIT_WINDOW_MS=900000
```

## Development Commands

```bash
cd kitchen-odyssey-backend

# Install dependencies
npm install

# Start development server
npm run dev          # http://localhost:3000

# Build for production
npm run build

# Start production server
npm run start

# Run linter
npm run lint
```

## MongoDB Atlas Considerations

### Free Tier Limitations
- **Connection Pooling:** Max 500 connections
- **Storage:** 512 MB
- **RAM:** Shared (not guaranteed)

### Mitigation Strategies
```javascript
// Connection pooling
const options = {
  maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE) || 10,
  minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE) || 2,
  serverSelectionTimeoutMS: 5000
}

// Pagination for large datasets
const recipes = await Recipe.find()
  .limit(limit)
  .skip((page - 1) * limit)
  .lean()  // Return plain JS objects
  .select('title description category')  // Projection
```

## Security Considerations

### Password Hashing
```javascript
import bcrypt from 'bcrypt'

const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10)  // 10 salt rounds
}

const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash)
}
```

### JWT Token Management
```javascript
import jwt from 'jsonwebtoken'

const generateToken = (user) => {
  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }  // Short-lived access token
  )
}

const refreshToken = (user) => {
  return jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }  // Long-lived refresh token
  )
}
```

### CORS Configuration
```javascript
// In route handler or proxy.js
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',')
const origin = request.headers.get('origin')

if (allowedOrigins.includes(origin)) {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}
```

## Migration Status

### Completed
- ✅ Next.js project created with `src/` structure
- ✅ Environment template documented
- ✅ Migration plan finalized

### Pending (Explicit Approval Required)
- ⏸️ MongoDB connection implementation
- ⏸️ Mongoose models creation
- ⏸️ Repository layer implementation
- ⏸️ Service layer implementation
- ⏸️ API route implementation
- ⏸️ Authentication with JWT
- ⏸️ Error handling middleware
- ⏸️ Testing setup

## Related Documentation
- [Frontend Overview](../../Kitchen_Odyssey/.serena/memories/project-overview.md) - React frontend
- [Migration Plan](../../Kitchen_Odyssey/plan/architecture-nextjs-mongodb-migration-1.md) - Complete migration guide
- [API Contract](../../Kitchen_Odyssey/docs/api-contract-specification-1.md) - API specification

## Memory Management
- **Project:** kitchen-odyssey-backend (Next.js API)
- **Last Updated:** 2026-02-17
- **Maintained By:** Serena MCP Server
- **Purpose:** Backend project overview and API reference
