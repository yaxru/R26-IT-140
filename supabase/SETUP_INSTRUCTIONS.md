# Opsis Database Setup Guide

## Step 1: Run Database Schema in Supabase

1. Go to **Supabase Dashboard** → Your project
2. Navigate to **SQL Editor**
3. Create a new query and copy the entire content from `supabase/setup.sql`
4. Run the query to create all tables and RLS policies

**Expected tables created:**

- `supervisors` - Supervisor application data
- `workers` - Worker accounts (created by bulk import)
- `daily_inputs` - Worker productivity logs
- `skill_matrix` - Worker skills
- `operator_productivity` - Current performance metrics
- `move_recommendations` - Reallocation suggestions
- `production_status` - Line/station status

---

## Step 2: Set Up Supervisor Account

### Find Your Supervisor User ID

1. Go to **Authentication → Users** in Supabase
2. Click on **yasirusenarathna@gmail.com**
3. Copy the **User ID** (UUID)

### Fix the User Metadata

Run this SQL query in **Supabase SQL Editor**, replacing `USER_ID` with the actual ID:

```sql
-- Set supervisor role in auth.users
UPDATE auth.users
SET raw_user_meta_data = '{"role": "supervisor"}'::jsonb
WHERE email = 'yasirusenarathna@gmail.com';

-- Add supervisor to supervisors table
INSERT INTO public.supervisors (id, name, managed_line_id)
VALUES ('USER_ID', 'Yasiru Senarathna', 'LINE-A');
```

---

## Step 3: Test the Setup

### Test 1: Login Page

1. Go to http://localhost:3000/login
2. Enter: **yasirusenarathna@gmail.com**
3. Enter password: **your password**
4. Should redirect to dashboard

### Test 2: Workforce Page (Bulk Import)

1. Go to http://localhost:3000/workforce
2. Create a test CSV file:

```csv
firstName,workerId,lineId
TestWorker,1001,LINE-A
AnotherWorker,1002,LINE-B
```

3. Upload and import
4. Should see success message with credentials

### Test 3: Check Database

Run this in Supabase SQL Editor:

```sql
SELECT * FROM public.workers;
SELECT * FROM public.supervisors;
```

---

## Troubleshooting 401 Errors

### Problem: "Failed to fetch" or 401 Unauthorized

**Cause 1: Missing Role Metadata**

```sql
-- Check if role is set
SELECT email, raw_user_meta_data FROM auth.users
WHERE email = 'yasirusenarathna@gmail.com';
```

**Fix:** Run Step 2 above

**Cause 2: Missing Supervisor Profile**

```sql
-- Check if supervisor record exists
SELECT * FROM public.supervisors
WHERE id = 'USER_ID';
```

**Fix:** Insert into supervisors table (Step 2)

**Cause 3: RLS Policies Blocking Access**

```sql
-- Check RLS is enabled (should return 't')
SELECT relrowsecurity FROM pg_class WHERE relname = 'workers';

-- Check policies exist
SELECT schemaname, tablename, policyname, permissive
FROM pg_policies
WHERE tablename IN ('workers', 'supervisors');
```

**Fix:** Re-run setup.sql to ensure all policies are created

---

## Edge Function Deployment

Once database is set up:

```bash
supabase functions deploy bulk-create-workers
```

**Environment variables required:**

- `SUPABASE_URL` - Your project URL
- `SUPABASE_ANON_KEY` - Your anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (for admin operations)

---

## Key Points

✅ **Workers table** stores auth.users.id as foreign key  
✅ **Supervisors table** requires manual entry for app metadata  
✅ **RLS policies** ensure workers see only own data, supervisors see all  
✅ **Edge Function** uses service role key to create accounts  
✅ **Email domain** is always `@opsis.int`
