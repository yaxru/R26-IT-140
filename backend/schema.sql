-- =====================================================================
-- risk_analyze — Supabase schema additions
-- Student: B.Benjamin (IT22182050) — Function 1: Real-Time Risk Detection
--
-- This is ADDITIVE ONLY. It does not touch existing rows or drop
-- anything. Safe to run against the live project in the Supabase SQL
-- editor. Run once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extend the existing `operators` table with flag/submission state.
--    (worker_reallocation already expects `operators(operator_id,
--    current_station)` to exist — this only adds columns, and creates
--    the table first only if it somehow doesn't exist yet.)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS operators (
    operator_id      TEXT PRIMARY KEY,
    current_station  TEXT
);

ALTER TABLE operators ADD COLUMN IF NOT EXISTS submission_count INT NOT NULL DEFAULT 0;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS is_flagged        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS flagged_at        TIMESTAMPTZ;
ALTER TABLE operators ADD COLUMN IF NOT EXISTS flag_reason       TEXT;

-- ---------------------------------------------------------------------
-- 2. job_card_entries — one row per hourly Digital Job Card submission.
--    This is the new table risk_analyze owns.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_card_entries (
    id                      BIGSERIAL PRIMARY KEY,
    operator_id             TEXT NOT NULL REFERENCES operators(operator_id) ON DELETE CASCADE,
    station_id              TEXT,               -- links back to production_status.station_id

    -- raw inputs (the Digital Job Card formula's variables)
    output                  NUMERIC NOT NULL,
    smv                     NUMERIC NOT NULL,
    manpower                NUMERIC NOT NULL,
    working_minutes         NUMERIC NOT NULL,

    -- context captured with every entry
    shift                   TEXT DEFAULT 'day',      -- day | night
    operator_skill          TEXT DEFAULT 'B',        -- A | B | C
    machine_status          TEXT DEFAULT 'ok',       -- ok | maintenance | breakdown
    downtime_reason         TEXT,                    -- forced when status = LOW

    -- computed by this service (actual efficiency, %)
    efficiency               NUMERIC NOT NULL,
    status                   TEXT NOT NULL,          -- HIGH | MEDIUM | LOW

    -- from the predictive model (real or, until Adithya's service is
    -- live, this service's own mock — see main.py)
    predicted_output         NUMERIC,
    predicted_efficiency     NUMERIC,
    efficiency_class         TEXT,                   -- High Efficiency | Low Efficiency
    batch_completion_time    NUMERIC,                -- minutes, estimated

    -- risk / variance analysis
    risk_score                NUMERIC,                -- % variance vs predicted output
    risk_level                 TEXT,                   -- LOW | MEDIUM | HIGH
    is_outlier                 BOOLEAN NOT NULL DEFAULT FALSE,

    created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_card_entries_operator_id ON job_card_entries(operator_id);
CREATE INDEX IF NOT EXISTS idx_job_card_entries_station_id ON job_card_entries(station_id);
CREATE INDEX IF NOT EXISTS idx_job_card_entries_created_at ON job_card_entries(created_at DESC);

-- ---------------------------------------------------------------------
-- 3. notifications — flag/risk alerts for the operator + supervisor
--    dashboards.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id           BIGSERIAL PRIMARY KEY,
    operator_id  TEXT REFERENCES operators(operator_id) ON DELETE CASCADE,
    audience     TEXT NOT NULL DEFAULT 'operator',  -- operator | supervisor
    type         TEXT NOT NULL,                     -- FLAG | RISK_ALERT
    message      TEXT NOT NULL,
    is_read      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_operator_id ON notifications(operator_id);

-- ---------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------
-- * `production_status.actual_productivity` (existing table, owned by
--   worker_reallocation) is UPDATED by this service after every
--   submission — as a 0.0–1.0 ratio, matching the existing convention
--   (e.g. 0.75 = 75%). No schema change needed there.
-- * If RLS is enabled on your Supabase project, make sure the key you
--   put in SUPABASE_KEY (service_role recommended for a backend
--   service) can read/write `operators`, `job_card_entries`,
--   `notifications`, and update `production_status`.
