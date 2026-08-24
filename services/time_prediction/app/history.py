"""PostgreSQL persistence for prediction runs.

The model remains stateless; this module only records the inputs and output of
each successful prediction so the supervisor dashboard can show a history.
"""

from __future__ import annotations

import logging
import os
from typing import Any

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # dotenv is a convenience; environment variables still work.
    pass

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # Keep the API readable while dependencies are being installed.
    psycopg = None  # type: ignore[assignment]
    dict_row = None  # type: ignore[assignment]


logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://garment_user:garment_password@127.0.0.1:5434/garment_predictor",
)

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS prediction_runs (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    department VARCHAR(100) NOT NULL,
    team DOUBLE PRECISION NOT NULL,
    batch_qty INTEGER NOT NULL,
    production_date DATE NOT NULL,
    no_of_workers DOUBLE PRECISION NOT NULL,
    over_time DOUBLE PRECISION NOT NULL,
    smv DOUBLE PRECISION NOT NULL,
    machine_breakdown_minutes DOUBLE PRECISION NOT NULL DEFAULT 0,
    predicted_productivity DOUBLE PRECISION NOT NULL,
    efficiency_level VARCHAR(40) NOT NULL,
    delay_prediction VARCHAR(80) NOT NULL,
    base_time_minutes DOUBLE PRECISION NOT NULL,
    base_time_hours DOUBLE PRECISION NOT NULL,
    estimated_time_minutes DOUBLE PRECISION NOT NULL,
    estimated_time_hours DOUBLE PRECISION NOT NULL
);

CREATE INDEX IF NOT EXISTS prediction_runs_created_at_idx
    ON prediction_runs (created_at DESC);
"""


class PredictionHistoryStore:
    def __init__(self, database_url: str = DATABASE_URL):
        self.database_url = database_url
        self._ready = False
        self._last_error = ""

    def _connect(self):
        if psycopg is None:
            raise RuntimeError("PostgreSQL driver is not installed. Run pip install -r requirements.txt")
        return psycopg.connect(self.database_url, connect_timeout=3)

    def initialize(self) -> bool:
        try:
            with self._connect() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(CREATE_TABLE_SQL)
            self._ready = True
            self._last_error = ""
            logger.info("Prediction history database is ready")
            return True
        except Exception as exc:  # Database availability must not stop model predictions.
            self._ready = False
            self._last_error = str(exc)
            logger.warning("Prediction history database unavailable: %s", exc)
            return False

    @property
    def status(self) -> str:
        if self._ready:
            return "connected"
        return "unavailable"

    @property
    def last_error(self) -> str:
        return self._last_error

    def save(self, request: Any, result: dict[str, Any], production_date: str | None = None) -> int | None:
        """Save one model run and return its id, or None when storage is unavailable."""
        try:
            with self._connect() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO prediction_runs (
                            department, team, batch_qty, production_date,
                            no_of_workers, over_time, smv, machine_breakdown_minutes,
                            predicted_productivity, efficiency_level, delay_prediction,
                            base_time_minutes, base_time_hours,
                            estimated_time_minutes, estimated_time_hours
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        (
                            request.department,
                            request.team,
                            request.batch_qty,
                            production_date or request.date,
                            request.no_of_workers,
                            request.over_time,
                            request.smv,
                            result["machine_breakdown_minutes"],
                            result["predicted_productivity"],
                            result["efficiency_level"],
                            result["delay_prediction"],
                            result["base_time_minutes"],
                            result["base_time_hours"],
                            result["estimated_time_minutes"],
                            result["estimated_time_hours"],
                        ),
                    )
                    row = cursor.fetchone()
            self._ready = True
            self._last_error = ""
            return int(row[0]) if row else None
        except Exception as exc:
            self._ready = False
            self._last_error = str(exc)
            logger.warning("Could not save prediction history: %s", exc)
            return None

    def list_recent(self, limit: int = 20) -> list[dict[str, Any]]:
        try:
            with self._connect() as connection:
                with connection.cursor(row_factory=dict_row) as cursor:
                    cursor.execute(
                        """
                        SELECT id, created_at, department, team, batch_qty,
                               production_date, no_of_workers, over_time, smv,
                               machine_breakdown_minutes, predicted_productivity,
                               efficiency_level, delay_prediction, base_time_minutes,
                               base_time_hours, estimated_time_minutes, estimated_time_hours
                        FROM prediction_runs
                        ORDER BY created_at DESC
                        LIMIT %s
                        """,
                        (limit,),
                    )
                    rows = cursor.fetchall()
            self._ready = True
            self._last_error = ""
            return [
                {
                    **row,
                    "created_at": row["created_at"].isoformat(),
                    "date": row.pop("production_date").isoformat(),
                }
                for row in rows
            ]
        except Exception as exc:
            self._ready = False
            self._last_error = str(exc)
            raise RuntimeError(f"Prediction history is unavailable: {exc}") from exc
