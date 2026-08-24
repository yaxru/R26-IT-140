import type { EmployeeUser, SupervisorUser } from "./api";

const EMPLOYEE_KEY = "risk-analyze.employee";
const SUPERVISOR_KEY = "risk-analyze.supervisor";

type StoredEmployee = { token: string; user: EmployeeUser };
type StoredSupervisor = { token: string; user: SupervisorUser };

export function saveEmployeeSession(data: StoredEmployee) {
  localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(data));
}
export function getEmployeeSession(): StoredEmployee | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(EMPLOYEE_KEY);
  return raw ? JSON.parse(raw) : null;
}
export function clearEmployeeSession() {
  localStorage.removeItem(EMPLOYEE_KEY);
}

export function saveSupervisorSession(data: StoredSupervisor) {
  localStorage.setItem(SUPERVISOR_KEY, JSON.stringify(data));
}
export function getSupervisorSession(): StoredSupervisor | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SUPERVISOR_KEY);
  return raw ? JSON.parse(raw) : null;
}
export function clearSupervisorSession() {
  localStorage.removeItem(SUPERVISOR_KEY);
}
