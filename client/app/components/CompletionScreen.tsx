"use client";

import { useEffect, useState } from "react";

export default function CompletionScreen({
  onRestart,
}: {
  onRestart?: () => void;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center text-center gap-6 px-6 w-full h-full animate-in fade-in zoom-in-95 duration-700 ease-out">
      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-100 to-sky-100 shadow-sm flex items-center justify-center text-6xl animate-[bounce_3s_infinite_ease-in-out]">
        🎉
      </div>

      <div className="mt-4">
        <h1 className="text-2xl font-medium text-slate-700">All done!</h1>
        <p className="text-slate-500 mt-2 max-w-sm leading-relaxed">
          Thank you for checking in. Your responses have been recorded and your
          profile is up to date.
        </p>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-[2rem] shadow-sm border border-slate-100 px-6 py-5 w-full max-w-sm text-left space-y-3 text-sm text-slate-600">
        <div className="flex justify-between">
          <span>Questions answered</span>
          <span className="font-semibold text-slate-800">10/10</span>
        </div>
        <div className="flex justify-between">
          <span>Games completed</span>
          <span className="font-semibold text-slate-800">2/2</span>
        </div>
        <div className="flex justify-between">
          <span>Data submitted</span>
          <span className="font-semibold text-indigo-500">Securely ✓</span>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-4">
        You can return to your workstation now — no further action needed.
      </p>

      {onRestart && (
        <div
          className={`transition-all duration-700 transform ${
            show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          } mt-6`}
        >
          <button
            onClick={onRestart}
            className="select-none text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors py-2 px-4 rounded-full hover:bg-slate-50"
          >
            Return to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
