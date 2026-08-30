"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import ProgressBar from "./ProgressBar";
import WelcomeScreen from "./WelcomeScreen";
import InstructionScreen from "./InstructionScreen";
import IceBreakerScreen from "./IceBreakerScreen";
import Pss10Questionnaire from "./Pss10Questionnaire";
import EggCrackerGame from "./EggCrackerGame";
import PrecisionInflatorGame from "./PrecisionInflatorGame";
import CompletionScreen from "./CompletionScreen";

import * as api from "@/lib/stress/api";
import {
  STEP_ORDER,
  StepId,
  SessionInfo,
  Pss10Answers,
  InflatorTrial,
} from "@/lib/stress/types";

export default function StressAssessment() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [step, setStep] = useState<StepId>("welcome");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A simple toggle to trigger CSS re-renders for smooth transitions
  const [fadeKey, setFadeKey] = useState(0);

  useEffect(() => {
    if (!token) {
      setError(
        "This link is missing a token. Please use the link sent to you.",
      );
      setLoading(false);
      return;
    }
    api
      .resolveSession(token)
      .then((s) => setSession(s))
      .catch((e) =>
        setError(e.message ?? "This link is invalid or has expired."),
      )
      .finally(() => setLoading(false));
  }, [token]);

  const stepIndex = STEP_ORDER.indexOf(step);
  const progress = (stepIndex / (STEP_ORDER.length - 1)) * 100;

  const transitionTo = (nextStep: StepId) => {
    setFadeKey((prev) => prev + 1);
    setStep(nextStep);
  };

  async function guard<T>(fn: () => Promise<T>) {
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleBaseline(pressures: number[]) {
    if (!session) return;
    const ok = await guard(() =>
      api.submitBaseline(session.session_id, pressures),
    );
    if (ok) transitionTo("pss10");
  }

  async function handlePss10(answers: Pss10Answers) {
    if (!session) return;
    const ok = await guard(() => api.submitPss10(session.session_id, answers));
    if (ok) transitionTo("game1");
  }

  async function handleGame1(pressures: number[], responseTimeMs: number) {
    if (!session) return;
    const ok = await guard(() =>
      api.submitGame1(session.session_id, pressures, responseTimeMs),
    );
    if (ok) transitionTo("game2");
  }

  async function handleGame2(trials: InflatorTrial[]) {
    if (!session) return;
    const ok = await guard(() => api.submitGame2(session.session_id, trials));
    if (!ok) return;
    await guard(() => api.predict(session.session_id));
    transitionTo("complete");
  }

  if (loading) {
    return (
      <SplashMessage
        bg="#FFCA28"
        label="Loading"
        text="Getting things ready…"
        pattern="pattern-dots"
      />
    );
  }

  if (error && !session) {
    return (
      <SplashMessage
        bg="#F87171"
        label="Error"
        text={error}
        pattern="pattern-zigzag"
      />
    );
  }

  return (
    <div className="min-h-dvh w-full bg-[#1a1a1a] relative overflow-hidden">
      <ProgressBar progress={progress} />

      {error && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#F87171] text-white text-xs font-bold px-5 py-3 rounded-2xl z-50 uppercase tracking-widest text-center w-[90%] max-w-md shadow-xl">
          {error}
        </div>
      )}

      {/* key forces remount on each step transition */}
      <div
        key={fadeKey}
        className={`w-full h-dvh transition-opacity duration-300 ease-in-out ${busy ? "opacity-40 pointer-events-none" : "opacity-100"}`}
      >
        {step === "welcome" && (
          <WelcomeScreen
            workerName={session?.worker_name ?? ""}
            onBegin={() => transitionTo("instructions-pss10")}
          />
        )}

        {step === "instructions-pss10" && (
          <InstructionScreen
            step="Step 1 of 3"
            stepKey="instructions-pss10"
            title={"10 quick\nquestions"}
            bullets={[
              "How you've felt this past month.",
              "Options range from Never to Very Often.",
              "Fully confidential — no impact on your work record.",
            ]}
            actionLabel="Got it, Next"
            onNext={() => transitionTo("instructions-game1")}
          />
        )}

        {step === "instructions-game1" && (
          <InstructionScreen
            step="Step 2 of 3"
            stepKey="instructions-game1"
            title={"Egg cracker\ngame"}
            bullets={[
              "9 eggs appear on screen.",
              "Tap gently to crack each one.",
              "Too much pressure = burst. Control your force.",
            ]}
            actionLabel="Let's Crack Some Eggs"
            onNext={() => transitionTo("instructions-game2")}
          />
        )}

        {step === "instructions-game2" && (
          <InstructionScreen
            step="Step 3 of 3"
            stepKey="instructions-game2"
            title={"Precision\nhold game"}
            bullets={[
              "Press & hold to inflate the balloon into the ring.",
              "Too hard pops it, too soft won't reach.",
              "3 short rounds, 10 seconds each.",
            ]}
            actionLabel="Ready, Let's Go"
            onNext={() => transitionTo("icebreaker")}
          />
        )}

        {step === "icebreaker" && (
          <IceBreakerScreen onComplete={handleBaseline} />
        )}

        {step === "pss10" && <Pss10Questionnaire onComplete={handlePss10} />}

        {step === "game1" && <EggCrackerGame onComplete={handleGame1} />}

        {step === "game2" && <PrecisionInflatorGame onComplete={handleGame2} />}

        {step === "complete" && <CompletionScreen />}
      </div>
    </div>
  );
}

function SplashMessage({
  bg,
  label,
  text,
  pattern,
}: {
  bg: string;
  label: string;
  text: string;
  pattern?: string;
}) {
  return (
    <div
      className="min-h-dvh w-full flex flex-col relative"
      style={{ backgroundColor: bg }}
    >
      <div
        className={`absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none ${pattern || ""}`}
      />

      {/* Top half loader */}
      <div className="flex-1 w-full flex items-center justify-center relative z-10">
        <div className="w-16 h-16 border-4 border-white/20 border-t-white/80 rounded-full animate-spin" />
      </div>

      {/* Bottom half text */}
      <div className="h-[45%] shrink-0 w-full bg-[#1a1a1a] relative z-20">
        <div className="w-full max-w-md mx-auto h-full px-7 flex flex-col items-center justify-center text-center">
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">
            {label}
          </p>
          <p className="text-2xl font-black text-white uppercase leading-snug">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}
