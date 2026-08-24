import DashboardShell from "../components/dashboard-shell";
import BatchEstimatePanel from "../components/batch-estimate-panel";

export default function BatchEstimatePage() {
  return <DashboardShell active="estimate"><BatchEstimatePanel /></DashboardShell>;
}
