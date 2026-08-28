"use client";

export default function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="fixed top-0 left-0 right-0 h-1.5 bg-slate-100 z-50">
      <div
        className="h-full bg-gradient-to-r from-indigo-300 via-indigo-400 to-sky-400 transition-all duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}
