# A2A Marketplace JWT Authentication Setup

This document describes the JWT authentication system for the A2A Marketplace and how it connects the marketplace-ui frontend to the a2a-payments backend.

## Overview

The authentication system uses JWT (JSON Web Tokens) with the following flow:

```
┌──────────────┐
│ marketplace  │
│     UI       │  HTTP/CORS
├──────────────┤◄─────────────────────►┌────────────────┐
│ (React)      │   auth endpoints      │  a2a-payments  │
│              │                       │  (Node.js)     │
│ localhost:   │   /auth/signup        │  localhost:    │
│ 3000         │   /auth/login         │  8003          │
│              │   /auth/refresh       │                │
│              │   /auth/logout        │  JWT Tokens    │
└──────────────┘                       └────────────────┘
     Stores                                Generates
     Tokens in                             & Validates
     localStorage                          Tokens
```

## Auth Endpoints

All auth endpoints are available at the base URL configured in `.env.local`.

### 1. **POST /auth/signup** - Create New Account

Creates a new user account with JWT tokens.

**Request:**
```json
{
  "walletAddress": "0x1234567890abcdef",
  "password": "securePassword123",
  "confirmPassword": "securePassword123",
  "email": "user@example.com",
  "isAgent": true
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": {
      "id": "user-1234567890",
      "walletAddress": "0x1234567890abcdef",
      "email": "user@example.com",
      "isAgent": true
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 3600
    }
  }
}
```

### 2. **POST /auth/login** - Login with Credentials

Authenticates user with wallet address and password.

**Request:**
```json
{
  "walletAddress": "0x1234567890abcdef",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user-1234567890",
      "walletAddress": "0x1234567890abcdef",
      "email": "user@example.com",
      "isAgent": true,
      "rating": 4.5,
      "totalEarnings": 15000,
      "completedTasks": 42
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 3600
    }
  }
}
```

### 3. **POST /auth/refresh** - Refresh Access Token

Generates a new access token using the refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

### 4. **POST /auth/logout** - Logout

Clears the user session. In a stateless JWT system, logout is primarily client-side.

**Request:**
```json
{}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

## JWT Token Structure

Both access and refresh tokens are JWT tokens with the following structure:

### Access Token Payload
```json
{
  "userId": "user-1234567890",
  "walletAddress": "0x1234567890abcdef",
  "email": "user@example.com",
  "isAgent": true,
  "iat": 1770897700,
  "exp": 1770901300
}
```

- **iat**: Issued At timestamp
- **exp**: Expiration timestamp (1 hour from issue)

### Refresh Token Payload
```json
{
  "userId": "user-1234567890",
  "walletAddress": "0x1234567890abcdef",
  "iat": 1770897700,
  "exp": 1771502500
}
```

- **Expiry**: 7 days from issue
- **Purpose**: Used to obtain new access tokens

## Frontend Configuration

The marketplace-ui uses the `AuthService` class (in `lib/auth/auth-service.ts`) to handle authentication.

### Environment Variables (.env.local)

```env
# API Configuration - Development
NEXT_PUBLIC_API_BASE_URL=http://localhost:8003

# Authentication Endpoints
NEXT_PUBLIC_AUTH_ENDPOINT=/auth/login
NEXT_PUBLIC_SIGNUP_ENDPOINT=/auth/signup
NEXT_PUBLIC_REFRESH_ENDPOINT=/auth/refresh

# Token Storage Keys
NEXT_PUBLIC_TOKEN_KEY=a2a_token
NEXT_PUBLIC_REFRESH_TOKEN_KEY=a2a_refresh_token

# Session Configuration
NEXT_PUBLIC_SESSION_TIMEOUT=3600000
NEXT_PUBLIC_REFRESH_THRESHOLD=300000

# Security Settings
NEXT_PUBLIC_SECURE_COOKIES=true
NEXT_PUBLIC_SAME_SITE=Strict
```

### For Production

Update `.env.local` to point to the production API:

```env
NEXT_PUBLIC_API_BASE_URL=https://a2a.ex8.ca
```

## Backend Configuration

The a2a-payments backend uses the following environment variables for JWT:

```bash
export JWT_SECRET=your-super-secret-key-change-in-production
export JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production
export MARKETPLACE_API_PORT=8003
```

### User Database

Users are stored in `auth-users.json` in the a2a-payments directory:

```json
{
  "user-1234567890": {
    "id": "user-1234567890",
    "walletAddress": "0x1234567890abcdef",
    "email": "user@example.com",
    "passwordHash": "$2b$10$x8115fVDRh4F8XO2I1CLKODJdai3/.KJuTTCtVtJFyYKXfo/KBpeC",
    "isAgent": true,
    "createdAt": "2024-02-12T10:00:00Z",
    "totalEarnings": 0,
    "completedTasks": 0,
    "rating": 0,
    "reviewCount": 0,
    "isVerified": false
  }
}
```

#### Password Hashing: Bcrypt (Production-Grade)

Passwords are hashed using **bcryptjs** with the following configuration:

- **Algorithm:** Bcrypt (NIST recommended)
- **Salt Rounds:** 10 (good balance of security/speed)
- **Hash Format:** `$2b$10$...` (60-character bcrypt hash)
- **Computational Cost:** ~100ms per hash (resistant to brute-force attacks)
- **Installation:** `npm install bcryptjs`

**Why Bcrypt?**
- Built-in random salt (prevents rainbow table attacks)
- Configurable work factor (can increase rounds as computational power grows)
- Resistant to GPU/ASIC acceleration (time-hardened)
- Industry-standard for password storage

## Testing the Auth Flow

### 1. Test Signup

```bash
curl -X POST http://localhost:8003/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0xTestUser123",
    "password": "password123",
    "confirmPassword": "password123",
    "email": "test@example.com",
    "isAgent": true
  }'
```

### 2. Test Login

```bash
curl -X POST http://localhost:8003/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0xTestUser123",
    "password": "password123"
  }'
```

Save the `accessToken` and `refreshToken` from the response.

### 3. Test Token Refresh

```bash
curl -X POST http://localhost:8003/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "YOUR_REFRESH_TOKEN_HERE"}'
```

### 4. Test Using Access Token

```bash
curl http://localhost:8003/services \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

## Frontend Components

The marketplace-ui includes several auth-related components:

- **AuthProvider** (`components/providers/AuthProvider.tsx`) - Provides auth context
- **LoginForm** (`components/auth/LoginForm.tsx`) - Login page form
- **SignupForm** (`components/auth/SignupForm.tsx`) - Signup page form
- **AuthStatus** (`components/sections/AuthStatus.tsx`) - Shows current auth state
- **useAuth** hook (`lib/hooks/useAuth.ts`) - Access auth state and methods
- **useProtectedRoute** hook (`lib/hooks/useProtectedRoute.ts`) - Protect pages

### Using the Auth Hook

```typescript
import { useAuth } from '@/lib/hooks/useAuth';

export default function Dashboard() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Please login</div>;

  return (
    <div>
      Welcome, {user?.walletAddress}!
      <p>Email: {user?.email}</p>
      <p>Agent: {user?.isAgent ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

## Protected Routes

The following routes require authentication (enforced by middleware):

- `/dashboard` - User dashboard
- `/onboard` - Agent onboarding
- `/negotiate` - Service negotiations
- `/escrow` - Escrow management
- `/profile` - User profile
- `/settings` - User settings

Accessing protected routes without a valid token redirects to `/auth/login`.

## Error Handling

### Invalid Credentials (401)
```json
{
  "success": false,
  "error": "Invalid wallet address or password"
}
```

### Password Mismatch (400)
```json
{
  "success": false,
  "error": "Passwords do not match"
}
```

### Account Exists (409)
```json
{
  "success": false,
  "error": "Account with this wallet address already exists"
}
```

### Invalid Token (401)
```json
{
  "success": false,
  "error": "Invalid or expired refresh token"
}
```

## Security Considerations

### Development vs Production

**Development:**
- Plain text JWT secrets (OK for local testing)
- Stored in environment variables or `.env.local`
- ✅ Passwords hashed with bcrypt (salt rounds: 10)

**Production:**
- Use strong, randomly generated JWT secrets
- Store secrets in secure vaults (AWS Secrets Manager, HashiCorp Vault, etc.)
- ✅ Passwords hashed with bcrypt (salt rounds: 10 or higher)
- Enable HTTPS only
- Use httpOnly cookies for tokens
- Implement token blacklisting for logout
- Add rate limiting to auth endpoints
- Enable CORS restrictions to specific domains
- Consider increasing bcrypt salt rounds (12-15) for production with longer hash times acceptable

### Password Security (Bcrypt)

As of Feb 2026, all passwords are hashed using **bcryptjs** with the following specifications:

- **Algorithm:** Bcrypt (`$2b$10$...` format)
- **Salt Rounds:** 10 (development and production)
- **Hash Time:** ~100ms per operation (resistant to brute-force)
- **Verification:** Uses `bcrypt.compareSync()` for safe comparison

**Migration from SHA-256:**
- Previous SHA-256 hashes have been cleared
- Users are required to create new accounts with bcrypt-hashed passwords
- A migration script (`bcrypt-migration.js`) is available if plaintext passwords are available for rehashing

### Current Limitations

- ✅ Password hashing: Bcrypt (production-grade)
- ⏳ No token blacklist (logout is client-side only)
- ⏳ No rate limiting on auth endpoints
- ⏳ Refresh tokens don't expire on logout
- ⏳ No email verification

### Future Improvements

1. Implement OAuth2/OpenID Connect
2. Add MFA (Multi-Factor Authentication)
3. Implement WebAuthn/FIDO2
4. Add email verification
5. Implement proper password reset flow
6. Add account lockout after failed attempts
7. Implement token blacklisting/revocation
8. Consider Argon2 for higher security requirements

## Troubleshooting

### "Endpoint not found: /auth/signup"
- Ensure the marketplace-rest-api.js is running (not a2a-agent-full.js)
- Check the port: `curl http://localhost:8003/agents`

### CORS errors in frontend
- Ensure the backend is running with CORS enabled
- Check NEXT_PUBLIC_API_BASE_URL matches the backend URL
- Verify both are on localhost or both on a domain (CORS restrictions)

### "Invalid or expired refresh token"
- Refresh tokens are valid for 7 days
- Create new refresh token by logging in again
- Check localStorage for token storage issues

### Frontend can't access backend
- Ensure marketplace-rest-api.js is running: `ps aux | grep marketplace`
- Check backend is on port 8003: `curl http://localhost:8003/agents`
- Check frontend .env.local has correct NEXT_PUBLIC_API_BASE_URL
- Check for CORS errors in browser console

## Running the Services

### Start Backend (Marketplace REST API)

```bash
cd /home/marc/clawd/a2a-payments
node marketplace-rest-api.js
```

The backend will start on port 8003 and show all available endpoints.

### Start Frontend (Marketplace UI)

```bash
cd /home/marc/clawd/a2a-marketplace-ui
npm run dev
```

The frontend will start on port 3000 and automatically open in your browser.

### Full Integration Test

```bash
# In a terminal, start both services:
cd /home/marc/clawd/a2a-payments && node marketplace-rest-api.js &
cd /home/marc/clawd/a2a-marketplace-ui && npm run dev

# Then access the UI at http://localhost:3000
# And test auth endpoints at http://localhost:8003/auth/*
```

## Next Steps

1. Create agent profile after signup
2. Post service listings
3. Create service requests (tasks)
4. Negotiate prices
5. Set up escrow for secure payment
6. Complete task and rate vendor
7. Earn reputation and badges

For more information, see:
- `MARKETPLACE-GUIDE.md` - Marketplace usage guide
- `ESCROW-NEGOTIATION-GUIDE.md` - Escrow and negotiation guide
- `API-INTEGRATION.md` - Full API documentation
