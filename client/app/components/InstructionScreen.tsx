"use client";

interface Props {
  step: string;
  emoji: string;
  title: string;
  bullets: string[];
  actionLabel: string;
  onNext: () => void;
}

export default function InstructionScreen({
  step,
  emoji,
  title,
  bullets,
  actionLabel,
  onNext,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-6 px-6 w-full h-full animate-in fade-in slide-in-from-right-4 duration-500 ease-out">
      <span className="text-xs font-medium tracking-widest text-slate-400 uppercase">
        {step}
      </span>

      <div className="text-6xl animate-[bounce_3s_infinite_ease-in-out]">
        {emoji}
      </div>

      <h2 className="text-xl font-medium text-slate-700">{title}</h2>

      <ul className="bg-white/80 backdrop-blur-sm rounded-[2rem] shadow-sm border border-slate-100 px-6 py-6 w-full max-w-sm text-left space-y-4">
        {bullets.map((b, i) => (
          <li
            key={i}
            className="flex gap-3 text-sm text-slate-600 leading-relaxed animate-in fade-in slide-in-from-left-2"
            style={{
              animationDelay: `${150 + i * 100}ms`,
              animationFillMode: "both",
            }}
          >
            <span className="text-indigo-400 font-bold">•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onNext}
        className="select-none w-full max-w-sm bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-medium py-4 rounded-[2rem] shadow-sm transition-all duration-200 active:scale-95"
      >
        {actionLabel}
      </button>
    </div>
  );
}
