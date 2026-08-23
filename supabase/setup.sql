-- =========================================================
-- DATABASE SETUP FOR OPSIS FACTORY MANAGEMENT SYSTEM
-- Two separate tables: supervisors and operators
-- =========================================================

-- =========================================================
-- 1. CLEANUP (Drop tables in reverse dependency order)
-- =========================================================
DROP TABLE IF EXISTS public.move_recommendations CASCADE;
DROP TABLE IF EXISTS public.daily_inputs CASCADE;
DROP TABLE IF EXISTS public.operator_productivity CASCADE;
DROP TABLE IF EXISTS public.skill_matrix CASCADE;
DROP TABLE IF EXISTS public.operators CASCADE;
DROP TABLE IF EXISTS public.supervisors CASCADE;
DROP TABLE IF EXISTS public.production_status CASCADE;


-- =========================================================
-- 2. CREATE TABLES
-- =========================================================

-- Supervisors Registry (Auth users with supervisor role)
CREATE TABLE public.supervisors (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  managed_line_id text,
  created_at timestamp with time zone DEFAULT now()
);

-- Operators Registry (Populated via CSV upload from workforce page)
-- Auth users are created separately by Edge Function
CREATE TABLE public.operators (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_id text NOT NULL UNIQUE,          -- 4-digit ID
  name text NOT NULL,                      -- Operator's name
  phone_number text,                       -- For distributing credentials
  contact_email text,                      -- Worker's personal email
  internal_email text NOT NULL UNIQUE,     -- Generated auth email (e.g yasiru.4092@opsis.int)
  created_at timestamp with time zone DEFAULT now()
);

-- Daily Work Logs (Submitted from worker dashboard)
CREATE TABLE public.daily_inputs (
  id serial PRIMARY KEY,
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  station_id text,
  quantity_completed integer NOT NULL CHECK (quantity_completed >= 0),
  logged_at timestamp with time zone DEFAULT now()
);

-- Operator Productivity & Current Placement
CREATE TABLE public.operator_productivity (
  operator_id uuid PRIMARY KEY REFERENCES public.operators(id) ON DELETE CASCADE,
  current_line_id text NOT NULL,
  current_station text,
  productivity_level double precision DEFAULT 0.0,
  last_calculated_at timestamp with time zone DEFAULT now()
);

-- Skill Matrix
CREATE TABLE public.skill_matrix (
  id serial PRIMARY KEY,
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  machine_type text NOT NULL,
  proficiency_grade character CHECK (proficiency_grade = ANY (ARRAY['A', 'B', 'C']))
);

-- Move Recommendations (Evaluates operator_productivity)
CREATE TABLE public.move_recommendations (
  id serial PRIMARY KEY,
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  from_line text,
  to_station text NOT NULL,
  profit_score double precision,
  instruction text,
  status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'accepted', 'rejected'])),
  created_at timestamp with time zone DEFAULT now()
);

-- Global Line / Station Production Status
CREATE TABLE public.production_status (
  station_id text PRIMARY KEY,
  line_id text,
  wip integer DEFAULT 0,
  targeted_productivity double precision DEFAULT 0.80,
  actual_productivity double precision DEFAULT 0.0,
  required_skill text NOT NULL DEFAULT ''
);


-- =========================================================
-- 3. ENABLE ROW LEVEL SECURITY (RLS)
-- =========================================================
ALTER TABLE public.supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_productivity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.move_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_status ENABLE ROW LEVEL SECURITY;


-- =========================================================
-- 4. CONFIGURE RLS POLICIES
-- =========================================================

-- ═══════════════════════════════════════════════════════
-- OPERATORS POLICIES
-- ═══════════════════════════════════════════════════════
CREATE POLICY "Operators can view own profile"
  ON public.operators FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Supervisors can view all operators"
  ON public.operators FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor');

CREATE POLICY "Supervisors can create operators (via Edge Function)"
  ON public.operators FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor');

CREATE POLICY "Supervisors can update operators"
  ON public.operators FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor');


-- ═══════════════════════════════════════════════════════
-- DAILY INPUTS POLICIES
-- ═══════════════════════════════════════════════════════
CREATE POLICY "Operators can log daily inputs"
  ON public.daily_inputs FOR INSERT TO authenticated
  WITH CHECK (operator_id = auth.uid());

CREATE POLICY "Operators can view own daily inputs"
  ON public.daily_inputs FOR SELECT TO authenticated
  USING (operator_id = auth.uid());

CREATE POLICY "Supervisors can view all daily inputs"
  ON public.daily_inputs FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor');


-- ═══════════════════════════════════════════════════════
-- OPERATOR PRODUCTIVITY POLICIES
-- ═══════════════════════════════════════════════════════
CREATE POLICY "Operators can view own productivity"
  ON public.operator_productivity FOR SELECT TO authenticated
  USING (operator_id = auth.uid());

CREATE POLICY "Supervisors can view all productivity"
  ON public.operator_productivity FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor');

CREATE POLICY "Supervisors can manage productivity"
  ON public.operator_productivity FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor');


-- ═══════════════════════════════════════════════════════
-- SKILL MATRIX POLICIES
-- ═══════════════════════════════════════════════════════
CREATE POLICY "Operators can view own skills"
  ON public.skill_matrix FOR SELECT TO authenticated
  USING (operator_id = auth.uid());

CREATE POLICY "Supervisors can view all skills"
  ON public.skill_matrix FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor');

CREATE POLICY "Supervisors can manage skill matrix"
  ON public.skill_matrix FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor');


-- ═══════════════════════════════════════════════════════
-- MOVE RECOMMENDATIONS POLICIES
-- ═══════════════════════════════════════════════════════
CREATE POLICY "Operators can view own move instructions"
  ON public.move_recommendations FOR SELECT TO authenticated
  USING (operator_id = auth.uid());

CREATE POLICY "Supervisors can view all move recommendations"
  ON public.move_recommendations FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor');

CREATE POLICY "Supervisors can manage move recommendations"
  ON public.move_recommendations FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor');


-- ═══════════════════════════════════════════════════════
-- PRODUCTION STATUS POLICIES
-- ═══════════════════════════════════════════════════════
CREATE POLICY "Authenticated users can read production status"
  ON public.production_status FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Supervisors can manage production status"
  ON public.production_status FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'supervisor');


-- =========================================================
-- 5. SETUP SUPERVISOR ACCOUNT (RUN AFTER CREATING USER)
-- =========================================================
-- After creating yasirusenarathna@gmail.com in Supabase Auth:
-- 1. Get the user ID from auth.users table
-- 2. Update their metadata to mark as supervisor:
--    UPDATE auth.users
--    SET raw_user_meta_data = '{"role": "supervisor"}'::jsonb
--    WHERE email = 'yasirusenarathna@gmail.com';
