"""Pydantic models for the risk_analyze service (request/response shapes)."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

Role = Literal["admin", "labor"]
Shift = Literal["day", "night"]
OperatorSkill = Literal["A", "B", "C"]
MachineStatus = Literal["ok", "maintenance", "breakdown"]
Status = Literal["HIGH", "MEDIUM", "LOW"]
RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]


# --------------------------- Auth ---------------------------

class RegisterRequest(BaseModel):
    name: str
    age: Optional[int] = None
    role: Role
    employee_code: Optional[str] = Field(None, description="Required when role='labor', e.g. 'EMP001'")
    password: str


class SupervisorLoginRequest(BaseModel):
    """Floor manager / supervisor login — by name + password."""
    name: str
    password: str


class EmployeeLoginRequest(BaseModel):
    """Employee login — by Employee ID ONLY. No password required."""
    employee_code: str


class AuthUser(BaseModel):
    id: int
    name: str
    role: Role
    employee_code: Optional[str] = None
    submission_count: Optional[int] = None
    is_flagged: Optional[bool] = None


class AuthResponse(BaseModel):
    message: str
    token: str
    user: AuthUser


# --------------------------- Laborer data / job card ---------------------------

class LaborerDataCreate(BaseModel):
    laborers_id: int
    output: float
    smv: float
    manpower: float
    working_minutes: float
    date: str
    shift: Shift = "day"
    operator_skill: OperatorSkill = "B"
    machine_status: MachineStatus = "ok"
    downtime_reason: Optional[str] = None


class Prediction(BaseModel):
    predicted_output: float
    predicted_efficiency: float
    efficiency_class: str
    batch_completion_time: Optional[float]


class RiskInfo(BaseModel):
    risk_score: float
    risk_level: RiskLevel
    is_outlier: bool


class SubmitResponse(BaseModel):
    entry: dict
    prediction: Prediction
    risk: RiskInfo
    flagged: bool
    flagged_now: bool
    submission_count: int
    notification: Optional[str]


class UpdateLaberRequest(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    role: Optional[Role] = None
    password: Optional[str] = None
