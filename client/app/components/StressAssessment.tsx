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
    return <CenteredMessage emoji="⏳" text="Getting things ready…" />;
  }

  if (error && !session) {
    return <CenteredMessage emoji="⚠️" text={error} />;
  }

  return (
    <div className="min-h-dvh flex items-center justify-center py-10 bg-[#FAFAFA] text-[#242424] transition-colors duration-700 ease-in-out">
      <ProgressBar progress={progress} />

      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-500 text-white text-sm px-4 py-2 rounded-xl shadow-sm z-50 animate-pulse">
          {error}
        </div>
      )}

      {/* The key prop forces React to unmount and remount, triggering the CSS fade-in animation */}
      <div
        key={fadeKey}
        className={`w-full max-w-md transition-opacity duration-500 ease-in-out ${busy ? "opacity-50 pointer-events-none" : "opacity-100"} animate-[fadeIn_0.8s_ease-in-out]`}
      >
        {step === "welcome" && (
          <WelcomeScreen
            workerName={session?.worker_name ?? ""}
            onBegin={() => transitionTo("instructions-pss10")}
          />
        )}

        {step === "instructions-pss10" && (
          <InstructionScreen
            step="Before we start · 1 of 3"
            emoji="📝"
            title="About the questions"
            bullets={[
              "10 quick questions about how you've felt this past month.",
              "Options range from Never to Very Often.",
              "Fully confidential — no impact on your work record.",
            ]}
            actionLabel="Next"
            onNext={() => transitionTo("instructions-game1")}
          />
        )}

        {step === "instructions-game1" && (
          <InstructionScreen
            step="Before we start · 2 of 3"
            emoji="🥚"
            title="Game 1 — Egg Cracker"
            bullets={[
              "Eggs will appear on screen.",
              "Tap gently to crack them.",
              "Tap too hard and the egg will burst — control your force.",
            ]}
            actionLabel="Next"
            onNext={() => transitionTo("instructions-game2")}
          />
        )}

        {step === "instructions-game2" && (
          <InstructionScreen
            step="Before we start · 3 of 3"
            emoji="🎈"
            title="Game 2 — Precision Inflator"
            bullets={[
              "Press & hold to inflate the balloon into the ring.",
              "Too hard pops it, too light won't reach it.",
              "3 short rounds, 10 seconds each.",
            ]}
            actionLabel="Let's Start"
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

function CenteredMessage({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center animate-[fadeIn_1s_ease-in-out]">
      <div className="text-5xl animate-bounce">{emoji}</div>
      <p className="text-gray-500 text-sm max-w-xs">{text}</p>
    </div>
  );
}
