"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePressureCapture } from "@/lib/usePressureCapture";

const QUESTIONS: { key: string; label: string; options: string[] }[] = [
  { key: "hobby", label: "What's a hobby you enjoy?", options: ["Sports", "Music", "Reading", "Gaming", "Cooking", "Other"] },
  { key: "genre", label: "Favourite music genre?", options: ["Pop", "Rock", "Hip-Hop", "Baila", "Classical", "Other"] },
  { key: "artist", label: "Favourite singer or band?", options: ["Local artist", "International", "Both", "Not sure"] },
  { key: "food", label: "Favourite food?", options: ["Rice & Curry", "Kottu", "String Hoppers", "Fast Food", "Other"] },
  { key: "show", label: "Favourite movie or show?", options: ["Action", "Comedy", "Drama", "Teledrama", "Other"] },
  { key: "extra", label: "One more thing you like?", options: ["Traveling", "Sleeping", "Chatting", "Sports", "Other"] },
];

export default function IceBreakerScreen({
  onComplete,
}: {
  onComplete: (pressures: number[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const { record, getSamples } = usePressureCapture();

  const question = QUESTIONS[index];
  const isLast = index === QUESTIONS.length - 1;

  function choose(option: string) {
    setSelected((s) => ({ ...s, [question.key]: option }));
    console.log("Selected:", { ...selected, [question.key]: option });
    console.log("question:", question);
    console.log("isLast:", isLast);
    if (isLast) {
      onComplete(getSamples());
    } else {
      setIndex((i) => i + 1);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-6 px-6 w-full"
    >
      <div className="text-center">
        <span className="text-xs font-semibold tracking-wide text-lilac-500 uppercase">
          Let's warm up · {index + 1}/{QUESTIONS.length}
        </span>
        <h2 className="text-lg font-semibold text-lilac-900 mt-2">
          {question.label}
        </h2>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="grid grid-cols-2 gap-3 w-full max-w-sm"
        >
          {question.options.map((opt) => (
            <motion.button
              key={opt}
              onPointerDown={record}
              onPointerMove={record}
              whileTap={{ scale: 0.94 }}
              onClick={() => choose(opt)}
              className={`tap-target no-select rounded-2xl py-4 px-3 text-sm font-medium shadow-card transition-colors ${
                selected[question.key] === opt
                  ? "bg-lilac-500 text-white"
                  : "bg-white/80 text-lilac-800"
              }`}
            >
              {opt}
            </motion.button>
          ))}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
