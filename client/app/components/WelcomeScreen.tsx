"use client";

import { motion } from "framer-motion";

export default function WelcomeScreen({
  workerName,
  onBegin,
}: {
  workerName: string;
  onBegin: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center text-center gap-6 px-6"
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="w-28 h-28 rounded-full bg-gradient-to-br from-lilac-300 to-mint-300 shadow-soft flex items-center justify-center text-5xl"
      >
        🌿
      </motion.div>

      <div>
        <p className="text-lilac-500 font-medium">Hi {workerName || "there"},</p>
        <h1 className="text-2xl font-semibold text-lilac-900 mt-1">
          Let's check in with you
        </h1>
      </div>

      <div className="bg-white/70 backdrop-blur rounded-3xl shadow-card px-6 py-5 w-full max-w-sm">
        <p className="text-sm text-lilac-700 leading-relaxed">
          10 quick questions + 2 short games — about{" "}
          <span className="font-semibold">7 minutes</span> in total.
        </p>
        <div className="h-px bg-lilac-100 my-3" />
        <p className="text-xs text-lilac-500 leading-relaxed">
          🔒 Your answers are private and will never affect your work record.
        </p>
      </div>

      <motion.button
        whileTap={{ scale: 0.96 }}
        whileHover={{ scale: 1.02 }}
        onClick={onBegin}
        className="tap-target no-select w-full max-w-sm bg-lilac-500 text-white font-semibold py-4 rounded-2xl shadow-soft"
      >
        Let's Begin
      </motion.button>
    </motion.div>
  );
}
