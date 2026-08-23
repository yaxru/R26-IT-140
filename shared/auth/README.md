# Opsis Shared Authentication Module

Centralized authentication utilities for the Opsis garment factory SaaS platform. This module provides both client-side and server-side auth functions to avoid code duplication across the application.

## Architecture

- **Client utilities** (`client.ts`): Browser-based auth for Next.js client components and login flows
- **Server utilities** (`server.ts`): Middleware and API route authentication
- **Types** (`types.ts`): Shared TypeScript interfaces for auth data structures

## Client Usage

### Getting Authorization Headers

Use in API requests to authenticated endpoints:

```typescript
// In a Client Component
"use client";

import { createClient } from "@/lib/supabase/client";
import { getAuthHeaders } from "@/shared/auth";

export default function MyComponent() {
  const supabase = createClient();

  const fetchData = async () => {
    const headers = await getAuthHeaders(supabase);
    const response = await fetch("/api/protected", { headers });
    // ...
  };
}
```

### Getting Current Session

Retrieve authenticated user info:

```typescript
import { getAuthSession } from "@/shared/auth";

const session = await getAuthSession(supabase);
if (session?.user) {
  console.log(session.user.id, session.user.email);
}
```

### Login/Logout

```typescript
import { signInWithPassword, signOut } from "@/shared/auth";

// Sign in
const error = await signInWithPassword(supabase, email, password);
if (!error) {
  router.push("/"); // Success
}

// Sign out
const signOutError = await signOut(supabase);
```

## Server Usage

### Protecting API Routes

```typescript
// app/api/workers/route.ts
import { requireAuth } from "@/shared/auth";

export async function POST(request: NextRequest) {
  const user = await requireAuth(
    request,
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  if (user instanceof NextResponse) {
    return user; // Return 401 error
  }

  // Now user is AuthUser, safely use it
  console.log(`Authenticated as ${user.email}`);
  // ...
}
```

### Verifying JWT Tokens

In Edge Functions or backend services:

```typescript
import { verifyJWT } from "@/shared/auth";

try {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) throw new Error("No token provided");

  const user = await verifyJWT(
    token,
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role for Edge Functions
  );

  console.log(`Request from: ${user.email}`);
} catch (error) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
  });
}
```

### CORS Handling

```typescript
import { handleCorsPrelight, CORS_HEADERS } from "@/shared/auth";

export async function POST(request: NextRequest) {
  // Handle OPTIONS requests
  const corsResponse = handleCorsPrelight(request);
  if (corsResponse) return corsResponse;

  // Your endpoint logic...
  return new Response(JSON.stringify({ data: "..." }), {
    headers: CORS_HEADERS,
  });
}
```

## Bulk Worker Creation

The `BulkCreateWorkersPayload` type is used for CSV imports. See the Supabase Edge Function `bulk-create-workers` for the implementation.

### Expected CSV Format

```
firstName, workerId, lineId
Yasiru, 4092, LINE-A
Amara, 3001, LINE-B
```

### Response Format

```typescript
{
  "success": [
    {
      "id": "uuid-from-auth",
      "email": "yasiru.4092@opsis.int",
      "firstName": "Yasiru",
      "workerId": "4092",
      "lineId": "LINE-A",
      "plainTextPin": "7834" // For printing credential cards
    }
  ],
  "failed": [
    {
      "workerId": "2000",
      "reason": "Email already exists"
    }
  ],
  "summary": {
    "total": 2,
    "created": 1,
    "failed": 1
  }
}
```

## Key Differences: Client vs Server

| Aspect              | Client (`client.ts`)              | Server (`server.ts`)                   |
| ------------------- | --------------------------------- | -------------------------------------- |
| **Where**           | Browser, Client Components        | Middleware, API routes, Edge Functions |
| **Supabase Client** | Browser client (`createClient()`) | Server client (`createServerClient()`) |
| **Use Case**        | UI interactions, form submissions | Route protection, token validation     |
| **Available To**    | All client components             | API handlers, middleware               |

## Troubleshooting

### "Email not confirmed" on login

The login page handles this gracefully. Check Supabase Auth settings:

- Go to **Auth → Providers → Email**
- Toggle off **"Confirm email"** to auto-confirm accounts

### "Invalid or expired token" in API requests

1. Ensure the user is logged in: `const session = await getAuthSession(supabase);`
2. Use `getAuthHeaders()` to include the token in every request
3. Check token expiration in Supabase dashboard

### CORS errors

- Ensure `CORS_HEADERS` are included in API responses
- Verify that the frontend URL is whitelisted in environment variables
- Test with `OPTIONS` preflight handling via `handleCorsPrelight()`

## Environment Variables Required

```bash
# .env.local (Frontend - Next.js)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000  # Backend URL
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000

# .env (Backend / Edge Functions)
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # For admin operations
```

## Extending the Module

To add new auth functionality:

1. Add types to `types.ts`
2. Add client functions to `client.ts` (if browser-accessible)
3. Add server functions to `server.ts` (if backend-only)
4. Export from `index.ts`
5. Document in this README
