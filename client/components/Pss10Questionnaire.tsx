"use client";

import { useState, useEffect } from "react";
import { Pss10Answers } from "@/lib/stress/types";
import { BlobCharacter } from "./BlobCharacter";

// Fixed solid purple for all PSS10 questions — consistent identity
const BG = "#6D28D9";
const BLOB = "#5B21B6";

const OPTIONS = [
  { label: "Never",        value: 0 },
  { label: "Almost Never", value: 1 },
  { label: "Sometimes",    value: 2 },
  { label: "Fairly Often", value: 3 },
  { label: "Very Often",   value: 4 },
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
      className="flex flex-col min-h-dvh overflow-hidden"
      style={{ backgroundColor: BG }}
    >
      {/* Character zone */}
      <div className="flex-1 flex flex-col items-center justify-end pb-6 pt-12 relative">
        {/* Progress pips across the top */}
        <div className="absolute top-6 left-6 right-6 flex gap-1">
          {QUESTIONS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full transition-all duration-300"
              style={{
                backgroundColor:
                  i < index
                    ? "rgba(255,255,255,0.8)"
                    : i === index
                    ? "rgba(255,255,255,0.5)"
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

      {/* Content zone */}
      <div
        className="shrink-0 bg-[#1a1a1a] px-7 pt-8 pb-10"
        style={{
          opacity: phase === "in" ? 1 : 0,
          transform: phase === "in" ? "translateX(0)" : "translateX(-16px)",
          transition: "opacity 0.25s ease, transform 0.25s ease",
        }}
      >
        <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-2">
          In the past month —
        </p>
        <h2 className="text-2xl font-black text-white uppercase leading-snug mb-6">
          How often have you {QUESTIONS[index]}
        </h2>

        {/* Option pill chips — horizontal wrap */}
        <div className="flex flex-wrap gap-2.5">
          {OPTIONS.map((opt) => {
            const isPicked = justPicked === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => choose(opt.value)}
                className="select-none px-5 py-3 rounded-2xl text-sm font-bold uppercase tracking-wide transition-all duration-150 active:scale-95"
                style={
                  isPicked
                    ? { backgroundColor: "#6D28D9", color: "#fff" }
                    : {
                        backgroundColor: "rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.7)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
