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
  Language,
  StepId,
  SessionInfo,
  Pss10Answers,
  InflatorTrial,
} from "@/lib/stress/types";
import { getStressCopy } from "@/lib/stress/translations";

export default function StressAssessment() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [language, setLanguage] = useState<Language>("en");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [step, setStep] = useState<StepId>("welcome");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A simple toggle to trigger CSS re-renders for smooth transitions
  const [fadeKey, setFadeKey] = useState(0);
  const copy = getStressCopy(language);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!token) return;
    api
      .resolveSession(token)
      .then((s) => setSession(s))
      .catch(() => setError("invalid-assessment-link"))
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
          : getStressCopy(language).genericError,
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

  if (!token) {
    return (
      <SplashMessage
        bg="#F87171"
        label={copy.error}
        text={copy.missingToken}
        pattern="pattern-zigzag"
      />
    );
  }

  if (loading) {
    return (
      <SplashMessage
        bg="#FFCA28"
        label={copy.loading}
        text={copy.loading}
        pattern="pattern-dots"
      />
    );
  }

  if (error && !session) {
    return (
      <SplashMessage
        bg="#F87171"
        label={copy.error}
        text={error === "invalid-assessment-link" ? copy.invalidLink : error}
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
            language={language}
            onLanguageChange={setLanguage}
            onBegin={() => transitionTo("instructions-pss10")}
          />
        )}

        {step === "instructions-pss10" && (
          <InstructionScreen
            stepKey="instructions-pss10"
            {...copy.instructions[0]}
            step={language === "si" ? "පියවර 1 / 3" : "Step 1 of 3"}
            onNext={() => transitionTo("instructions-game1")}
          />
        )}

        {step === "instructions-game1" && (
          <InstructionScreen
            stepKey="instructions-game1"
            {...copy.instructions[1]}
            step={language === "si" ? "පියවර 2 / 3" : "Step 2 of 3"}
            onNext={() => transitionTo("instructions-game2")}
          />
        )}

        {step === "instructions-game2" && (
          <InstructionScreen
            stepKey="instructions-game2"
            {...copy.instructions[2]}
            step={language === "si" ? "පියවර 3 / 3" : "Step 3 of 3"}
            onNext={() => transitionTo("icebreaker")}
          />
        )}

        {step === "icebreaker" && (
          <IceBreakerScreen language={language} onComplete={handleBaseline} />
        )}

        {step === "pss10" && (
          <Pss10Questionnaire language={language} onComplete={handlePss10} />
        )}

        {step === "game1" && (
          <EggCrackerGame language={language} onComplete={handleGame1} />
        )}

        {step === "game2" && (
          <PrecisionInflatorGame language={language} onComplete={handleGame2} />
        )}

        {step === "complete" && <CompletionScreen language={language} />}
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
