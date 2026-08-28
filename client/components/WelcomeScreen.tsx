"use client";

export default function WelcomeScreen({
  workerName,
  onBegin,
}: {
  workerName: string;
  onBegin: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-10 px-6 w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <div className="w-28 h-28 rounded-full bg-gradient-to-br from-indigo-100 to-sky-100 shadow-sm flex items-center justify-center text-5xl animate-[bounce_3s_infinite_ease-in-out]">
        🌿
      </div>

      <div>
        <p className="text-slate-500 font-medium">
          Hi {workerName || "there"},
        </p>
        <h1 className="text-2xl font-semibold text-slate-700 mt-2">
          Let's check in with you
        </h1>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-[2rem] shadow-sm border border-slate-100 px-6 py-6 w-full max-w-sm">
        <p className="text-sm text-slate-600 leading-relaxed">
          10 quick questions & 2 short games — about{" "}
          <span className="font-medium text-slate-800">7 minutes</span> in
          total.
        </p>
        <div className="h-px bg-slate-100 my-4" />
        <p className="text-xs text-slate-400 leading-relaxed">
          🔒 Your answers are private and will never affect your work record.
        </p>
      </div>

      <button
        onClick={onBegin}
        className="select-none w-full max-w-sm bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-medium py-4 rounded-[2rem] shadow-sm transition-all duration-200 active:scale-95"
      >
        Let's Begin
      </button>
    </div>
  );
}
