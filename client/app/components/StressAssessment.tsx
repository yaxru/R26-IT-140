"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import ProgressBar from "./ProgressBar";
import WelcomeScreen from "./WelcomeScreen";
import InstructionScreen from "./InstructionScreen";
import IceBreakerScreen from "./IceBreakerScreen";
import Pss10Questionnaire from "./Pss10Questionnaire";
import EggCrackerGame from "./EggCrackerGame";
import PrecisionInflatorGame from "./PrecisionInflatorGame";
import CompletionScreen from "./CompletionScreen";

import * as api from "@/lib/stress/api";
import { STEP_ORDER, StepId, SessionInfo, Pss10Answers, InflatorTrial } from "@/lib/stress/types";

export default function StressAssessment() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [step, setStep] = useState<StepId>("welcome");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("This link is missing a token. Please use the link sent to you.");
      setLoading(false);
      return;
    }
    api
      .resolveSession(token)
      .then((s) => setSession(s))
      .catch((e) => setError(e.message ?? "This link is invalid or has expired."))
      .finally(() => setLoading(false));
  }, [token]);

  const stepIndex = STEP_ORDER.indexOf(step);
  const progress = (stepIndex / (STEP_ORDER.length - 1)) * 100;

  async function guard<T>(fn: () => Promise<T>) {
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleBaseline(pressures: number[]) {
    if (!session) return;
    const ok = await guard(() => api.submitBaseline(session.session_id, pressures));
    if (ok) setStep("pss10");
  }

  async function handlePss10(answers: Pss10Answers) {
    if (!session) return;
    const ok = await guard(() => api.submitPss10(session.session_id, answers));
    if (ok) setStep("game1");
  }

  async function handleGame1(pressures: number[], responseTimeMs: number) {
    if (!session) return;
    const ok = await guard(() =>
      api.submitGame1(session.session_id, pressures, responseTimeMs)
    );
    if (ok) setStep("game2");
  }

  async function handleGame2(trials: InflatorTrial[]) {
    if (!session) return;
    const ok = await guard(() => api.submitGame2(session.session_id, trials));
    if (!ok) return;
    await guard(() => api.predict(session.session_id));
    setStep("complete");
  }

  if (loading) {
    return <CenteredMessage emoji="⏳" text="Getting things ready…" />;
  }

  if (error && !session) {
    return <CenteredMessage emoji="⚠️" text={error} />;
  }

  return (
    <div className="min-h-dvh flex items-center justify-center py-10">
      <ProgressBar progress={progress} />

      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-coral-500 text-white text-sm px-4 py-2 rounded-xl shadow-soft z-50">
          {error}
        </div>
      )}

      <div className={busy ? "opacity-60 pointer-events-none" : ""}>
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <WelcomeScreen
              key="welcome"
              workerName={session?.worker_name ?? ""}
              onBegin={() => setStep("instructions-pss10")}
            />
          )}

          {step === "instructions-pss10" && (
            <InstructionScreen
              key="instructions-pss10"
              step="Before we start · 1 of 3"
              emoji="📝"
              title="About the questions"
              bullets={[
                "10 quick questions about how you've felt this past month.",
                "Options range from Never to Very Often.",
                "Fully confidential — no impact on your work record.",
              ]}
              actionLabel="Next"
              onNext={() => setStep("instructions-game1")}
            />
          )}

          {step === "instructions-game1" && (
            <InstructionScreen
              key="instructions-game1"
              step="Before we start · 2 of 3"
              emoji="🥚"
              title="Game 1 — Egg Cracker"
              bullets={[
                "Eggs will appear on screen.",
                "Tap gently to crack them.",
                "Tap too hard and the egg will burst — control your force.",
              ]}
              actionLabel="Next"
              onNext={() => setStep("instructions-game2")}
            />
          )}

          {step === "instructions-game2" && (
            <InstructionScreen
              key="instructions-game2"
              step="Before we start · 3 of 3"
              emoji="🎈"
              title="Game 2 — Precision Inflator"
              bullets={[
                "Press & hold to inflate the balloon into the ring.",
                "Too hard pops it, too light won't reach it.",
                "3 short rounds, 10 seconds each.",
              ]}
              actionLabel="Let's Start"
              onNext={() => setStep("icebreaker")}
            />
          )}

          {step === "icebreaker" && (
            <IceBreakerScreen key="icebreaker" onComplete={handleBaseline} />
          )}

          {step === "pss10" && (
            <Pss10Questionnaire key="pss10" onComplete={handlePss10} />
          )}

          {step === "game1" && (
            <EggCrackerGame key="game1" onComplete={handleGame1} />
          )}

          {step === "game2" && (
            <PrecisionInflatorGame key="game2" onComplete={handleGame2} />
          )}

          {step === "complete" && <CompletionScreen key="complete" />}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CenteredMessage({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center">
      <motion.div
        animate={{ rotate: [0, 8, -8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-5xl"
      >
        {emoji}
      </motion.div>
      <p className="text-lilac-700 text-sm max-w-xs">{text}</p>
    </div>
  );
}
