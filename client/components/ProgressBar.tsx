"use client";

export default function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="absolute top-0 left-0 right-0 z-50 h-1 bg-white/10">
      <div
        className="h-full bg-white/70 transition-all duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}
