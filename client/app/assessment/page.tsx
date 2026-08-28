import { Suspense } from "react";
import { StressAssessment } from "./components/StressAssessment";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <StressAssessment />
    </Suspense>
  );
}
