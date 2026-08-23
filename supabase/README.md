# Supabase Setup for Opsis

This folder contains Supabase Edge Functions and database configuration for the Opsis garment factory SaaS.

## ⚠️ START HERE: Database Setup

**New to this project?** Follow the complete setup guide:

→ See [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md)

This includes:

1. Running the database schema
2. Configuring supervisor accounts
3. Troubleshooting 401 errors
4. Testing the complete flow

---

## Edge Functions

### `bulk-create-workers`

Creates worker accounts in bulk from CSV data. Supervisors can import worker lists and generate login credentials.

**Endpoint:** `POST /functions/v1/bulk-create-workers`

**Authentication:** Required (JWT Bearer token from supervisor account)

**Request Body:**

```typescript
{
  "workers": [
    {
      "firstName": "Yasiru",
      "workerId": "4092",
      "lineId": "LINE-A"
    },
    {
      "firstName": "Amara",
      "workerId": "3001",
      "lineId": "LINE-B"
    }
  ]
}
```

**Constraints:**

- Maximum 100 workers per request (prevents timeouts)
- `firstName`: Required, non-empty string
- `workerId`: Required, exactly 4 digits
- `lineId`: Required, non-empty string

**Response:**

```typescript
{
  "success": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "yasiru.4092@opsis.int",
      "firstName": "Yasiru",
      "workerId": "4092",
      "lineId": "LINE-A",
      "plainTextPin": "7834"
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

**Error Responses:**

| Status | Error                         | Description                      |
| ------ | ----------------------------- | -------------------------------- |
| 401    | Missing/Invalid Authorization | No Bearer token or token expired |
| 400    | Invalid JSON payload          | Malformed request body           |
| 413    | Payload too large             | More than 100 workers in request |

---

## Quick Deploy

Once your database is configured:

```bash
# Deploy the bulk-create-workers function
supabase functions deploy bulk-create-workers

# Or deploy all functions
supabase functions deploy
```

**Required Environment Variables:**

- `SUPABASE_URL` - Your project URL
- `SUPABASE_ANON_KEY` - Anon key (for auth verification)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for admin operations)
  updated_at timestamp not null default now()
  );

create index idx_workers_supervisor_id on public.workers(supervisor_id);
create index idx_workers_line_id on public.workers(line_id);
create index idx_workers_worker_id on public.workers(worker_id);

````

### Row Level Security (RLS)

```sql
-- Allow supervisors to view workers they created
alter table public.workers enable row level security;

create policy "Supervisors can view workers they created"
  on public.workers
  for select
  using (auth.uid() = supervisor_id);

create policy "Supervisors can insert workers"
  on public.workers
  for insert
  with check (auth.uid() = supervisor_id);
````

## Development

### Local Testing

Run Supabase locally for development:

```bash
supabase start
```

This spins up a local Postgres database and Supabase instance on `http://localhost:54321`.

Then deploy functions to local environment:

```bash
supabase functions deploy bulk-create-workers --project-id local
```

## Usage in Frontend

See [shared/auth/README.md](../../shared/auth/README.md) for client-side usage with `BulkCreateWorkersPayload` and response types.

### Example Integration

```typescript
// In workforce page
const handleBulkImport = async (workers: WorkerRecord[]) => {
  const headers = await getAuthHeaders(supabase);

  const response = await fetch(
    `${supabaseUrl}/functions/v1/bulk-create-workers`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ workers }),
    },
  );

  const result: BulkCreateResponse = await response.json();
  return result;
};
```

## Troubleshooting

### Function not deploying

Check Supabase CLI version:

```bash
supabase --version
```

Update if needed:

```bash
npm install -g supabase
```

### 401 Unauthorized

- Ensure Bearer token is valid
- Token may be expired; get a fresh one from `getAuthHeaders()`

### "No user in response"

- Check that `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- This key is required for the admin API

### Email already exists error

- Worker email format: `{firstName.toLowerCase()}.{workerId}@opsis.int`
- Check if a worker with this email already exists in the database
- Run migrations if new tables are missing

## References

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase Auth Admin API](https://supabase.com/docs/reference/typescript/admin-api)
