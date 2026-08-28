"use client";

import { motion } from "framer-motion";

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
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -32 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center text-center gap-5 px-6"
    >
      <span className="text-xs font-semibold tracking-wide text-lilac-500 uppercase">
        {step}
      </span>

      <div className="text-6xl animate-float">{emoji}</div>

      <h2 className="text-xl font-semibold text-lilac-900">{title}</h2>

      <ul className="bg-white/70 backdrop-blur rounded-3xl shadow-card px-6 py-5 w-full max-w-sm text-left space-y-3">
        {bullets.map((b, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 * i + 0.15 }}
            className="flex gap-2 text-sm text-lilac-700"
          >
            <span className="text-mint-500">•</span>
            <span>{b}</span>
          </motion.li>
        ))}
      </ul>

      <motion.button
        whileTap={{ scale: 0.96 }}
        whileHover={{ scale: 1.02 }}
        onClick={onNext}
        className="tap-target no-select w-full max-w-sm bg-lilac-500 text-white font-semibold py-4 rounded-2xl shadow-soft"
      >
        {actionLabel}
      </motion.button>
    </motion.div>
  );
}
