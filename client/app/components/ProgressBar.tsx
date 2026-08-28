"use client";

import { motion } from "framer-motion";

export default function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="fixed top-0 left-0 right-0 h-1.5 bg-lilac-100 z-50">
      <motion.div
        className="h-full bg-gradient-to-r from-lilac-400 via-lilac-500 to-mint-500"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}
