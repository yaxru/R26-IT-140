import DashboardShell from "../components/dashboard-shell";
import PredictionHistoryPanel from "../components/prediction-history-panel";

export default function PredictionHistoryPage() {
  return <DashboardShell active="history"><PredictionHistoryPanel /></DashboardShell>;
}
