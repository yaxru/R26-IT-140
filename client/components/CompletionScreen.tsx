"use client";

import { useEffect, useState } from "react";

export default function CompletionScreen({
  onRestart,
}: {
  onRestart?: () => void;
}) {
  const [show, setShow] = useState(false);
  const [confetti, setConfetti] = useState<{ x: number; y: number; color: string; delay: number }[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 400);
    // Generate confetti pieces
    setConfetti(
      Array.from({ length: 20 }, () => ({
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        color: ["#2dd4bf", "#f472b6", "#fb923c", "#a78bfa", "#34d399"][Math.floor(Math.random() * 5)],
        delay: Math.random() * 1.5,
      }))
    );
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-dvh px-6 py-12 text-center overflow-hidden">
      {/* Decorative blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute top-0 left-0 w-72 h-72 rounded-full bg-teal-200/25 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-violet-200/25 blur-3xl" />
      </div>

      {/* CSS confetti — spans floating down */}
      {confetti.map((c, i) => (
        <span
          key={i}
          className="pointer-events-none fixed w-2 h-4 rounded-sm opacity-0"
          style={{
            left: `${c.x}%`,
            top: `${c.y}%`,
            backgroundColor: c.color,
            animation: `slideUp 1.8s ease-out ${c.delay}s both`,
            transform: `rotate(${Math.random() * 40 - 20}deg)`,
          }}
        />
      ))}

      {/* Trophy orb */}
      <div
        className={`transition-all duration-700 ${show ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
      >
        <div className="relative w-36 h-36 mx-auto">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-200 to-orange-200 blur-xl opacity-60" />
          <div className="relative w-36 h-36 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center text-6xl shadow-2xl shadow-amber-200/60 anim-floatBob">
            🏆
          </div>
        </div>
      </div>

      {/* Text */}
      <div
        className={`mt-8 transition-all duration-700 delay-200 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
      >
        <h1 className="text-3xl font-bold text-slate-800">All done!</h1>
        <p className="text-slate-500 mt-2 max-w-xs leading-relaxed mx-auto">
          Thank you for checking in. Your session has been recorded securely.
        </p>
      </div>

      {/* Summary card */}
      <div
        className={`mt-8 w-full max-w-sm transition-all duration-700 delay-400 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
      >
        <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-100 shadow-md px-6 py-5 space-y-3">
          {[
            { label: "Questions answered", value: "10/10", color: "text-emerald-500" },
            { label: "Games completed", value: "2/2", color: "text-teal-500" },
            { label: "Data submitted", value: "Securely ✓", color: "text-violet-500" },
          ].map((row, i) => (
            <div
              key={i}
              className="flex justify-between items-center anim-slideRight"
              style={{ animationDelay: `${500 + i * 100}ms` }}
            >
              <span className="text-sm text-slate-500">{row.label}</span>
              <span className={`text-sm font-bold ${row.color}`}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <p
        className={`text-xs text-slate-400 mt-6 max-w-xs leading-relaxed transition-all duration-700 delay-700 ${show ? "opacity-100" : "opacity-0"}`}
      >
        You can return to your workstation now — no further action needed.
      </p>

      {onRestart && (
        <div
          className={`mt-6 transition-all duration-700 delay-1000 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <button
            onClick={onRestart}
            className="select-none text-sm font-medium text-slate-400 hover:text-teal-500 transition-colors py-2 px-5 rounded-full hover:bg-teal-50"
          >
            Return to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
