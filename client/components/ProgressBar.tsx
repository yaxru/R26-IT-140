"use client";

export default function ProgressBar({ progress }: { progress: number }) {
  return (
    <div
      className="fixed left-0 right-0 top-0 z-50 h-1.5 bg-[#20243A]/10"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(100, Math.max(0, progress)))}
      aria-label="Assessment progress"
    >
      <div
        className="h-full rounded-r-full bg-[#F18427] transition-all duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}
