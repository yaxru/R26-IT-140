-- =====================================================================
-- risk_analyze — DB schema
-- Real-Time Risk Detection & Digital Data Capture (Garment Line Efficiency)
--
-- Run this once in your Supabase project's SQL editor (or via `psql`
-- against the Supabase connection string). Ported from the original
-- prototype's schema.sql — same tables, now hosted on Supabase.
-- =====================================================================

-- Drop old copies if you're re-running this during development
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS laborers_data CASCADE;
DROP TABLE IF EXISTS labers CASCADE;

-- ---------------------------------------------------------------------
-- LABERS: both employees ("labor") and floor managers/supervisors ("admin")
-- employee_code is the human-friendly ID employees log in with
-- (e.g. "EMP001"). Admins don't need one.
-- ---------------------------------------------------------------------
CREATE TABLE labers (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(100) NOT NULL,
    age               INT,
    role              VARCHAR(10)  NOT NULL CHECK (role IN ('admin', 'labor')),
    employee_code     VARCHAR(20)  UNIQUE,
    password          VARCHAR(255) NOT NULL,          -- bcrypt hash
    submission_count  INT          NOT NULL DEFAULT 0, -- how many hourly logs they've ever submitted
    is_flagged        BOOLEAN      NOT NULL DEFAULT FALSE,
    flagged_at        TIMESTAMPTZ,
    flag_reason       TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- One employee must always have an employee_code
ALTER TABLE labers
    ADD CONSTRAINT employee_code_required_for_labor
    CHECK (role <> 'labor' OR employee_code IS NOT NULL);

-- ---------------------------------------------------------------------
-- LABORERS_DATA: one row per hourly Digital Job Card submission
-- ---------------------------------------------------------------------
CREATE TABLE laborers_data (
    id                     SERIAL PRIMARY KEY,
    laborers_id            INT NOT NULL REFERENCES labers(id) ON DELETE CASCADE,

    -- raw inputs (the formula's variables)
    output                 NUMERIC NOT NULL,
    smv                    NUMERIC NOT NULL,
    manpower               NUMERIC NOT NULL,
    working_minutes        NUMERIC NOT NULL,

    -- context captured with every entry
    shift                  VARCHAR(10)  DEFAULT 'day',   -- day | night
    operator_skill         VARCHAR(5)   DEFAULT 'B',     -- A | B | C
    machine_status         VARCHAR(20)  DEFAULT 'ok',    -- ok | maintenance | breakdown
    downtime_reason        VARCHAR(50),                  -- forced when status = LOW

    -- computed by this component (real actual efficiency)
    efficiency             NUMERIC NOT NULL,
    status                 VARCHAR(10) NOT NULL,          -- HIGH | MEDIUM | LOW

    -- returned by the predictive model (Function 2 — currently mocked)
    predicted_output       NUMERIC,
    predicted_efficiency   NUMERIC,
    efficiency_class       VARCHAR(20),                   -- High Efficiency | Low Efficiency
    batch_completion_time  NUMERIC,                        -- minutes, estimated

    -- risk / variance analysis (this component's own novelty)
    risk_score             NUMERIC,                        -- % variance vs predicted output
    risk_level             VARCHAR(10),                    -- LOW | MEDIUM | HIGH
    is_outlier             BOOLEAN NOT NULL DEFAULT FALSE,

    date                   DATE NOT NULL,
    time                   TIME NOT NULL DEFAULT CURRENT_TIME,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_laborers_data_laborers_id ON laborers_data(laborers_id);
-- Recommended for /laborers (all-entries) and /analysis ordering:
CREATE INDEX idx_laborers_data_date_time ON laborers_data(date DESC, time DESC);

-- ---------------------------------------------------------------------
-- NOTIFICATIONS: flag alerts for the employee themselves and for
-- the floor manager / supervisor dashboard
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
    id           SERIAL PRIMARY KEY,
    laborer_id   INT REFERENCES labers(id) ON DELETE CASCADE,
    audience     VARCHAR(15) NOT NULL DEFAULT 'employee', -- employee | supervisor
    type         VARCHAR(20) NOT NULL,                    -- FLAG | RISK_ALERT
    message      TEXT NOT NULL,
    is_read      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_laborer_id ON notifications(laborer_id);

-- ---------------------------------------------------------------------
-- Seed: create your first floor manager / supervisor account through
-- POST /register (role: "admin") — it hashes the password for you.
-- Employees are also created through /register (role: "labor",
-- employee_code required), then log in with just their employee_code
-- at /employee-login (no password).
-- ---------------------------------------------------------------------
