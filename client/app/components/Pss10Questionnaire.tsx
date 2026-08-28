"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pss10Answers } from "@/lib/types";

const OPTIONS = [
  { label: "Never", value: 0 },
  { label: "Almost Never", value: 1 },
  { label: "Sometimes", value: 2 },
  { label: "Fairly Often", value: 3 },
  { label: "Very Often", value: 4 },
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

  function choose(value: number) {
    const key = String(index + 1);
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (index === QUESTIONS.length - 1) {
      onComplete(next);
    } else {
      setIndex((i) => i + 1);
    }
  }

  const progress = ((index + 1) / QUESTIONS.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-6 px-6 w-full"
    >
      <div className="w-full max-w-sm">
        <div className="h-2 bg-lilac-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-mint-500"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <p className="text-xs text-lilac-500 mt-2 text-center">
          Question {index + 1} of {QUESTIONS.length}
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.h2
          key={index}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          className="text-lg font-semibold text-lilac-900 text-center max-w-sm min-h-[3.5rem]"
        >
          In the past month, how often have you {QUESTIONS[index]}
        </motion.h2>
      </AnimatePresence>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        {OPTIONS.map((opt) => (
          <motion.button
            key={opt.value}
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.01 }}
            onClick={() => choose(opt.value)}
            className="tap-target no-select bg-white/80 text-lilac-800 font-medium py-3.5 rounded-2xl shadow-card text-sm"
          >
            {opt.label}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
