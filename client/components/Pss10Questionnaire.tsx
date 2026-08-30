"use client";

import { useState, useEffect } from "react";
import { Pss10Answers } from "@/lib/stress/types";
import { BlobCharacter } from "./BlobCharacter";

const BG = "#6D28D9";
const BLOB = "#5B21B6";

const OPTIONS = [
  { label: "Never", value: 0, emoji: "😌" },
  { label: "Almost Never", value: 1, emoji: "🙂" },
  { label: "Sometimes", value: 2, emoji: "😐" },
  { label: "Fairly Often", value: 3, emoji: "😟" },
  { label: "Very Often", value: 4, emoji: "😰" },
];

const QUESTIONS = [
  "Felt upset because of something unexpected?",
  "Felt unable to control important things?",
  "Felt nervous or stressed?",
  "Felt confident about handling problems?",
  "Felt things were going your way?",
  "Found you could not cope with everything?",
  "Been able to control irritations?",
  "Felt on top of things?",
  "Been angered by things outside your control?",
  "Felt difficulties were piling up too high?",
];

export default function Pss10Questionnaire({
  onComplete,
}: {
  onComplete: (answers: Pss10Answers) => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Pss10Answers>({});
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [justPicked, setJustPicked] = useState<number | null>(null);

  useEffect(() => {
    setPhase("in");
    setJustPicked(null);
  }, [index]);

  function choose(value: number) {
    const next = { ...answers, [String(index + 1)]: value };
    setAnswers(next);
    setJustPicked(value);
    setPhase("out");

    setTimeout(() => {
      if (index === QUESTIONS.length - 1) {
        onComplete(next);
      } else {
        setIndex((i) => i + 1);
      }
    }, 280);
  }

  return (
    <div
      className="flex flex-col h-dvh w-full overflow-hidden relative"
      style={{ backgroundColor: BG }}
    >
      <div className="absolute inset-0 pattern-grid opacity-20 mix-blend-overlay pointer-events-none" />

      {/* Character zone */}
      <div className="flex-1 w-full flex flex-col relative z-10">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col items-center justify-end pb-4 relative">
          <div className="absolute top-6 left-6 right-6 flex gap-1 bg-black/20 p-2 rounded-full">
            {QUESTIONS.map((_, i) => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full transition-all duration-300"
                style={{
                  backgroundColor:
                    i < index
                      ? "rgba(255,255,255,0.9)"
                      : i === index
                        ? "rgba(255,255,255,0.6)"
                        : "rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>

          <div
            style={{
              opacity: phase === "in" ? 1 : 0,
              transition: "opacity 0.25s ease",
            }}
          >
            <BlobCharacter mood="calm" color={BLOB} />
          </div>
        </div>
      </div>

      {/* Content zone */}
      <div className="h-[60%] shrink-0 w-full bg-[#1a1a1a] relative z-20">
        <div
          className="w-full max-w-md mx-auto h-full px-6 py-6 flex flex-col items-center justify-center text-center"
          style={{
            opacity: phase === "in" ? 1 : 0,
            transform: phase === "in" ? "translateX(0)" : "translateX(-16px)",
            transition: "opacity 0.25s ease, transform 0.25s ease",
          }}
        >
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1 shrink-0">
            In the past month —
          </p>
          <h2 className="text-[1.3rem] font-black text-white uppercase leading-snug mb-4 px-2 shrink-0">
            How often have you {QUESTIONS[index]}
          </h2>

          <div className="flex flex-col w-full gap-2 shrink-0">
            {OPTIONS.map((opt) => {
              const isPicked = justPicked === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => choose(opt.value)}
                  className="select-none flex items-center justify-between w-full px-5 py-3.5 rounded-2xl text-sm font-bold uppercase tracking-wide transition-all duration-150 active:scale-95"
                  style={
                    isPicked
                      ? { backgroundColor: BG, color: "#fff" }
                      : {
                          backgroundColor: "rgba(255,255,255,0.08)",
                          color: "rgba(255,255,255,0.8)",
                        }
                  }
                >
                  <span>{opt.label}</span>
                  <span
                    className="text-xl"
                    style={{
                      filter: isPicked ? "none" : "grayscale(0.5) opacity(0.8)",
                    }}
                  >
                    {opt.emoji}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
