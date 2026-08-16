"use client";

import { useEffect, useState, useCallback } from "react";
import type { Bottleneck, RecommendResponse } from "../types";
import { BottleneckCard } from "../components/BottleneckCard";
import { RecommendationCard } from "../components/RecommendationCard";
import { ProfitabilityCard } from "../components/ProfitabilityCard";
import { StationSelector } from "../components/StationSelector";
import { ErrorBanner } from "../components/ErrorBanner";
import { createClient } from "@/lib/supabase/client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const RECOMMEND_INTERVAL_MS = 3_600_000; // auto-refresh recommendations every 1 hour

export default function WorkerReallocationPage() {
  const supabase = createClient();

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
  };

  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [bottlenecksError, setBottlenecksError] = useState<string | null>(null);
  const [activeBottleneck, setActiveBottleneck] = useState<Bottleneck | null>(
    null,
  );
  const [recommendation, setRecommendation] =
    useState<RecommendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ── Load stations once on mount ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const headers = await getAuthHeaders();
      fetch(`${API_BASE}/stations`, { headers })
        .then((res) => {
          if (!res.ok)
            throw new Error(`Failed to load stations (${res.status})`);
          return res.json();
        })
        .then((data: Bottleneck[]) => {
          setBottlenecks(data);
          setActiveBottleneck(data[0] ?? null);
        })
        .catch((e) =>
          setBottlenecksError(
            e instanceof Error ? e.message : "Could not load stations",
          ),
        );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRecommendation = useCallback(async (bottleneck: Bottleneck) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          bottleneck_station: bottleneck.station_id,
          required_skill: bottleneck.required_skill,
          targeted_productivity: bottleneck.targeted_productivity,
          actual_productivity: bottleneck.actual_productivity,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail ?? "Unknown error");
      }

      const data: RecommendResponse = await res.json();
      setRecommendation(data);
      setError(null);
      setAccepted(false);
      setLastUpdated(new Date());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to fetch recommendation",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeBottleneck) return;
    // Only fetch recommendations for genuine bottleneck stations
    if (!activeBottleneck.is_bottleneck) {
      setRecommendation(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchRecommendation(activeBottleneck);
    // Auto-refresh every hour
    const id = setInterval(
      () => fetchRecommendation(activeBottleneck),
      RECOMMEND_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [activeBottleneck, fetchRecommendation]);

  const handleAcceptMove = async () => {
    if (!recommendation || !activeBottleneck) return;
    setAccepting(true);
    try {
      const headers = await getAuthHeaders();
      const rawMoves =
        recommendation.moves && recommendation.moves.length > 0
          ? recommendation.moves
          : [
              {
                operator_id: recommendation.operator_id,
                from_station: recommendation.from_station,
                to_station: recommendation.to_station,
                proficiency_grade: recommendation.proficiency_grade,
              },
            ];

      const res = await fetch(`${API_BASE}/accept-move`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          moves: rawMoves.map((move) => ({
            operator_id: move.operator_id,
            from_station: move.from_station ?? null,
            to_station: move.to_station ?? activeBottleneck.station_id,
            machine_type: activeBottleneck.required_skill,
            proficiency_grade: move.proficiency_grade,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail ?? "Failed to accept move");
      }
      setAccepted(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to accept move. Please retry.",
      );
    } finally {
      setAccepting(false);
    }
  };

  const handleRefreshRecommendation = useCallback(() => {
    if (!activeBottleneck?.is_bottleneck) return;
    setLoading(true);
    setAccepted(false);
    fetchRecommendation(activeBottleneck);
  }, [activeBottleneck, fetchRecommendation]);

  const selectBottleneck = (b: Bottleneck) => {
    setActiveBottleneck(b);
    setLoading(true);
    setAccepted(false);
  };

  const bottleneckCount = bottlenecks.filter((b) => b.is_bottleneck).length;

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
            Worker Reallocation
          </p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Bottleneck &amp; Move Engine
          </h1>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 uppercase ${
            bottleneckCount > 0
              ? "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 ring-1 ring-orange-200 dark:ring-orange-900/60"
              : "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200 dark:ring-emerald-900/60"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 ${bottleneckCount > 0 ? "bg-orange-500 animate-pulse" : "bg-emerald-500"}`}
          />
          {bottleneckCount} bottleneck{bottleneckCount === 1 ? "" : "s"}
        </span>
      </div>

      <StationSelector
        stations={bottlenecks}
        active={activeBottleneck}
        onSelect={selectBottleneck}
      />

      {bottlenecksError && <ErrorBanner message={bottlenecksError} />}
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BottleneckCard bottleneck={activeBottleneck} />
        <RecommendationCard
          recommendation={recommendation}
          loading={loading}
          accepted={accepted}
          accepting={accepting}
          isBottleneck={activeBottleneck?.is_bottleneck ?? false}
          lastUpdated={lastUpdated}
          onRefresh={handleRefreshRecommendation}
          onAccept={handleAcceptMove}
        />
        <ProfitabilityCard recommendation={recommendation} />
      </div>

      <p className="text-center text-[10px] font-mono text-zinc-400 dark:text-zinc-700 pb-4">
        StitchFlow · Profitability Engine v1.0 · Recommendations refresh hourly
      </p>
    </div>
  );
}
