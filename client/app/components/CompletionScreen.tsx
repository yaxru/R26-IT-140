"use client";

import { motion } from "framer-motion";

const CONFETTI = Array.from({ length: 14 }, (_, i) => i);

export default function CompletionScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative flex flex-col items-center text-center gap-6 px-6 overflow-hidden"
    >
      {CONFETTI.map((i) => (
        <motion.span
          key={i}
          initial={{
            opacity: 0,
            x: (Math.random() - 0.5) * 240,
            y: -40,
          }}
          animate={{
            opacity: [0, 1, 0],
            y: 260,
            rotate: 360,
          }}
          transition={{ duration: 2.4, delay: i * 0.08, ease: "easeOut" }}
          className="absolute text-2xl select-none pointer-events-none"
        >
          {["🎉", "✨", "🌿", "💫"][i % 4]}
        </motion.span>
      ))}

      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.15 }}
        className="w-28 h-28 rounded-full bg-gradient-to-br from-mint-300 to-mint-500 shadow-soft flex items-center justify-center text-5xl"
      >
        ✅
      </motion.div>

      <div>
        <h1 className="text-2xl font-semibold text-lilac-900">
          All done — thank you!
        </h1>
        <p className="text-sm text-lilac-600 mt-2 max-w-sm">
          You've completed all tasks. Your responses are private and won't
          affect your work record.
        </p>
      </div>

      <div className="bg-white/70 backdrop-blur rounded-3xl shadow-card px-6 py-5 w-full max-w-sm text-left space-y-2 text-sm text-lilac-700">
        <div className="flex justify-between">
          <span>Questions answered</span>
          <span className="font-semibold">10/10</span>
        </div>
        <div className="flex justify-between">
          <span>Games completed</span>
          <span className="font-semibold">2/2</span>
        </div>
        <div className="flex justify-between">
          <span>Data submitted</span>
          <span className="font-semibold text-mint-700">Securely ✓</span>
        </div>
      </div>

      <p className="text-xs text-lilac-400">
        You can return to your workstation now — no further action needed.
      </p>
    </motion.div>
  );
}
