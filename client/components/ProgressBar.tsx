"use client";

export default function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      {/* Track */}
      <div className="h-1.5 bg-white/50">
        {/* Fill */}
        <div
          className="h-full bg-gradient-to-r from-teal-400 via-cyan-400 to-violet-400 transition-all duration-600 ease-out relative"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        >
          {/* Glow dot at the tip */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg shadow-teal-300/80 -mr-1" />
        </div>
      </div>
    </div>
  );
}
