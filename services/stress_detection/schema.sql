-- Stress Detection Component (Component 4) — Supabase schema

create table if not exists stress_assessments (
    session_id uuid primary key default gen_random_uuid(),
    worker_id varchar not null,
    worker_name varchar,
    session_datetime timestamptz not null default now(),

    pss10_score integer,
    pss10_classification varchar,

    avg_baseline_pressure float,
    avg_game1_pressure float,

    avg_inflator_pressure float,
    peak_inflator_pressure float,
    avg_time_on_target_ms integer,
    avg_jitter_index float,
    total_overshoot_count integer,

    avg_game_pressure float,
    pressure_gap float,
    pressure_status varchar,

    response_time_ms integer,

    model_output integer,
    model_confidence float,

    created_at timestamptz not null default now()
);

create index if not exists idx_stress_assessments_worker
    on stress_assessments (worker_id);

create index if not exists idx_stress_assessments_datetime
    on stress_assessments (session_datetime desc);

-- Row Level Security: workers submit via service-role backend only;
-- HR reads via authenticated Supabase session.
alter table stress_assessments enable row level security;

create policy "HR can read all assessments"
    on stress_assessments for select
    using (auth.role() = 'authenticated');
