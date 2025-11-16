# Security Improvements - Phases 1 & 2

## Overview
This document describes the security improvements implemented in Phases 1 & 2 to mitigate authentication vulnerabilities.

**Current Status:** Phase 2 (httpOnly Cookie Migration) - In Progress

## Changes Implemented

### 1. JWT Expiration Validation (auth.tsx)

Added three new utility functions to validate JWT tokens on the client side:

#### `decodeJWT(token: string): Record<string, unknown> | null`
- Decodes a JWT token without verifying the signature
- Returns the payload object or null if invalid
- Only use for reading claims on the client side (signature verification happens on server)

#### `isTokenExpired(token: string): boolean`
- Returns `true` if token is expired based on `exp` claim
- Returns `true` if token is invalid or malformed
- Safe to call with potentially invalid tokens

**Example:**
```typescript
import { isTokenExpired, getAuthToken } from '../common/authentication/auth';

const token = getAuthToken()?.token;
if (token && isTokenExpired(token)) {
  // Token is expired, trigger refresh
  await refreshToken();
}
```

#### `getTokenExpiresIn(token: string): number | null`
- Returns the number of seconds until token expiration
- Returns `null` if token is invalid or has no `exp` claim
- Useful for monitoring token lifetime

**Example:**
```typescript
import { getTokenExpiresIn } from '../common/authentication/auth';

const expiresIn = getTokenExpiresIn(token);
if (expiresIn !== null) {
  console.log(`Token expires in ${expiresIn} seconds`);
}
```

#### `shouldRefreshToken(): boolean`
- Returns `true` if token should be refreshed (expires in < 5 minutes)
- Automatically checks current stored token
- Useful for proactive refresh before token expires

**Example:**
```typescript
import { shouldRefreshToken } from '../common/authentication/auth';

if (shouldRefreshToken()) {
  // Proactively refresh token before it expires
  await refreshToken();
}
```

### 2. Exponential Backoff Retry Logic (refreshToken.tsx)

Enhanced the `refreshToken()` function with intelligent retry logic:

#### Retry Behavior
- **Max Retries:** 3 attempts
- **Backoff Formula:** `1000ms × 2^retryCount`
  - Attempt 0: immediate
  - Attempt 1: 1 second delay
  - Attempt 2: 2 seconds delay
  - Attempt 3: 4 seconds delay

#### Error Classification
- **Retryable Errors:** 429 (rate limit), 5xx (server errors), network errors
- **Non-Retryable:** 401 (session expired), 4xx client errors
- **Success:** Any 2xx response

#### Behavior
```
Refresh token request
  ↓
Success (2xx) → return true ✅
  ↓
401 Unauthorized → return false (session expired) 🔴
  ↓
429 or 5xx → retry with exponential backoff ↻
  ↓
Network error → retry with exponential backoff ↻
  ↓
Max retries exceeded → throw error ❌
```

#### Benefits
- **Reduces transient failures:** Handles temporary server issues, rate limiting, network hiccups
- **Prevents server overload:** Exponential backoff spreads retry attempts over time
- **Improves UX:** Users don't see errors from temporary issues
- **Clear failure mode:** 401 responses are handled immediately without retry

## Impact Analysis

### Security Impact
| Vulnerability | Mitigation | Effectiveness |
|---|---|---|
| XSS attack expiring tokens sooner | JWT validation checks if already expired | Low (XSS has bigger concerns) |
| Server transient errors causing auth failure | Exponential backoff retry logic | High |
| Refresh storms on server | Proper backoff prevents thundering herd | High |

### Performance Impact
| Scenario | Before | After |
|---|---|---|
| Token close to expiry, API call fails | Immediate refresh attempt | Can check first before attempting |
| Server returns 503 | Immediate error to user | 3 retries over 7 seconds = better chance of recovery |
| Network timeout | Immediate error to user | 3 retries improve success rate |
| Normal 401 (session expired) | Retry not applicable | Instant return false (no change) |

### Backward Compatibility
✅ **Fully backward compatible**
- New functions are additive (don't change existing behavior)
- `refreshToken()` still accepts same parameters, returns same type
- Retry logic is transparent to callers
- Existing code doesn't need to change

## Implementation Notes

### JWT Decoding
- Uses `atob()` which is widely supported
- No external dependencies required
- Only reads claims, doesn't verify signature (server does that)
- Handles malformed tokens gracefully (returns null/true/undefined)

### Retry Logic
- Implemented as recursive function with `retryCount` parameter
- Stored closure maintains state between retries
- Proper error handling with try/catch
- Distinguishes between HTTP errors and network errors

## Testing Recommendations

### Unit Tests
```typescript
describe('JWT Validation', () => {
  test('isTokenExpired returns true for expired token', () => {
    const expiredToken = 'eyJhbGc...'; // token with exp in past
    expect(isTokenExpired(expiredToken)).toBe(true);
  });

  test('shouldRefreshToken returns true if < 5 min to expiry', () => {
    // Mock localStorage with token expiring in 200 seconds
    expect(shouldRefreshToken()).toBe(true);
  });
});

describe('Refresh Token Retry Logic', () => {
  test('returns false on 401 without retrying', async () => {
    const mockServices = {
      fetch: jest.fn().mockResolvedValue({ status: 401 }),
      getAuthToken: jest.fn().mockReturnValue({ token: '...' })
    };

    const result = await refreshToken(mockServices);
    expect(result).toBe(false);
    expect(mockServices.fetch).toHaveBeenCalledTimes(1); // No retries
  });

  test('retries on 503 with exponential backoff', async () => {
    const mockServices = {
      fetch: jest.fn()
        .mockResolvedValueOnce({ status: 503 })
        .mockResolvedValueOnce({ status: 503 })
        .mockResolvedValueOnce({ ok: true, json: () => ({ token: '...' }) }),
      getAuthToken: jest.fn().mockReturnValue({ token: '...' })
    };

    const start = Date.now();
    const result = await refreshToken(mockServices);
    const elapsed = Date.now() - start;

    expect(result).toBe(true);
    expect(mockServices.fetch).toHaveBeenCalledTimes(3);
    expect(elapsed).toBeGreaterThanOrEqual(3000); // 1s + 2s backoff
  });
});
```

### Manual Testing
1. **Test JWT validation:**
   - Open browser DevTools
   - `const {isTokenExpired, getTokenExpiresIn} = await import('./src/common/authentication/auth.tsx')`
   - `isTokenExpired(getAuthToken().token)` - should return false (token not expired)
   - `getTokenExpiresIn(getAuthToken().token)` - should show seconds until expiry

2. **Test retry logic:**
   - Use Chrome DevTools Network Throttling → "Offline"
   - Trigger an auth request (e.g., navigate to protected route)
   - Verify request retries with delays in DevTools Network tab
   - Re-enable network and request should succeed on retry

3. **Test 401 handling:**
   - Manually delete token from localStorage while app is running
   - Try to make an API call
   - Should not retry, should redirect to /signin immediately

## Phase 2: httpOnly Cookie Migration

### Implementation Completed ✅

Moved refresh token from localStorage to httpOnly cookies for improved XSS protection.

#### Backend Changes (AuthController.cs)

**Modified `/api/auth/signin` endpoint:**
- Returns only access token in response body: `{ token: "..." }`
- Sets refresh token as httpOnly cookie with security flags:
  - `HttpOnly = true` - Not accessible via JavaScript
  - `Secure = true` - Only sent over HTTPS
  - `SameSite = Strict` - CSRF protection, cookie only sent to same-site requests
  - `Path = "/api/auth"` - Only sent to auth endpoints
  - `MaxAge = 7 days` - Cookie expiration

**Modified `/api/auth/refresh` endpoint:**
- Accepts refresh token from cookie automatically (not from request body)
- Returns only new access token in response body
- Sets new refresh token as httpOnly cookie (automatic rotation)

**Added `/api/auth/logout` endpoint:**
- Clears refresh token cookie on server
- Allows secure cleanup of session

#### Frontend Changes

**Modified `refreshToken.tsx`:**
- Added `credentials: "include"` to fetch requests
- Browser automatically sends httpOnly cookies with requests
- Still sends access token in request body for backward compatibility

**Modified Apollo Client configuration (`configureClient.tsx`):**
- Added `credentials: "include"` to HttpLink
- Enables cookie-based authentication for GraphQL requests

**Modified REST API wrapper (`makeRequest.tsx`):**
- Added `credentials: "include"` to all REST API calls

**Enhanced logout hook (`useSignOut.tsx`):**
- Calls `/api/auth/logout` endpoint to clear server-side cookie
- Falls back to client-side logout if API call fails

#### Security Impact

| Vulnerability | Before | After |
|---|---|---|
| **XSS to steal tokens** | ❌ tokens in localStorage accessible | ✅ refresh token in httpOnly cookie |
| **Refresh token exposure** | ⚠️ sent in request body | ✅ auto-sent by browser |
| **CSRF attacks** | ⚠️ not protected | ✅ `SameSite=Strict` protects cookies |
| **Session cleanup** | ⚠️ client-only | ✅ server-side logout endpoint |

#### Backward Compatibility

✅ **Fully compatible** - Works with both old and new server endpoints

### Flow Diagram

**Sign In:**
```
POST /api/auth/signin { username, password }
  ↓
Server generates tokens
  ↓
Response: { token: "access_token" } + Set-Cookie: refreshToken=...
  ↓
Frontend stores only access token in localStorage
```

**Refresh Token:**
```
POST /api/auth/refresh + credentials: "include"
  ↓
Browser auto-sends: Cookie: refreshToken=...
  ↓
Server validates and rotates refresh token
  ↓
Response: { token: "new_access_token" } + Set-Cookie: refreshToken=...
```

**Logout:**
```
POST /api/auth/logout + credentials: "include"
  ↓
Server clears refresh token cookie
  ↓
Frontend removes access token from localStorage
```

## Next Steps (Phase 3+)

After Phase 2 validation, proceed with:

1. **CSRF Protection** - Add CSRF token validation to sensitive endpoints
2. **Refresh Token Server TTL** - Add server-side expiration for refresh tokens
3. **Session Timeout** - Add server-side session timeout with sliding window
4. **Comprehensive Logging** - Enhanced debugging for auth flow issues
5. **Rate Limiting** - Add rate limiting to auth endpoints to prevent brute force

## Configuration

### Customization
Edit these constants in `src/api/refreshToken.tsx` to adjust retry behavior:

```typescript
const MAX_RETRIES = 3;        // Number of retry attempts
const INITIAL_DELAY_MS = 1000; // First backoff delay (1 second)
```

Edit this threshold in `src/common/authentication/auth.tsx` to change proactive refresh window:

```typescript
// In shouldRefreshToken() - refresh if less than 5 minutes remaining
return expiresIn !== null && expiresIn < 300;
```

## References

- [JWT Claims (RFC 7519)](https://tools.ietf.org/html/rfc7519#section-4.1)
- [HTTP 429 Rate Limiting](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)
- [Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
