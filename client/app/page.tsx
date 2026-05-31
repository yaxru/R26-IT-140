"use client";

import { useEffect, useState, useCallback } from "react";
import type { Bottleneck, RecommendResponse } from "./types";
import { BottleneckCard } from "./components/BottleneckCard";
import { RecommendationCard } from "./components/RecommendationCard";
import { ProfitabilityCard } from "./components/ProfitabilityCard";
import { StationSelector } from "./components/StationSelector";
import { ErrorBanner } from "./components/ErrorBanner";
import { FactoryOverview } from "./components/FactoryOverview";
import { EfficiencyChart } from "./components/EfficiencyChart";
import type { ChartPoint } from "./components/EfficiencyChart";
import { createClient } from "@/lib/supabase/client";

// Chart: one snapshot per hour, only during working hours
const MAX_CHART_POINTS = 24; // up to 24-hour history
const WORK_START_HOUR = 6; // 06:00
const WORK_END_HOUR = 18; // 18:00
const CHART_INTERVAL_MS = 3_600_000; // 1 hour

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const RECOMMEND_INTERVAL_MS = 3_600_000; // auto-refresh recommendations every 1 hour

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Home() {
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
  const [chartHistory, setChartHistory] = useState<ChartPoint[]>([]);

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

  // ── Hourly overall-progress chart (working hours only) ─────────────────
  useEffect(() => {
    const takeSnapshot = async () => {
      const h = new Date().getHours();
      if (h < WORK_START_HOUR || h >= WORK_END_HOUR) return;
      const headers = await getAuthHeaders().catch(() => ({}));
      const res = await fetch(`${API_BASE}/stations`, { headers }).catch(
        () => null,
      );
      if (!res || !res.ok) return;
      const stations: Bottleneck[] = await res.json().catch(() => []);
      const active = stations.filter(
        (b) =>
          b.actual_productivity !== null &&
          b.targeted_productivity !== null &&
          b.targeted_productivity > 0,
      );
      if (active.length === 0) return;
      const avg =
        active.reduce(
          (s, b) =>
            s + (b.actual_productivity! / b.targeted_productivity!) * 100,
          0,
        ) / active.length;
      const now = new Date();
      const label = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
      setChartHistory((prev) => {
        const next = [
          ...prev,
          { label, efficiency: Math.round(avg * 10) / 10 },
        ];
        return next.length > MAX_CHART_POINTS
          ? next.slice(-MAX_CHART_POINTS)
          : next;
      });
    };

    takeSnapshot(); // snapshot on load
    const id = setInterval(takeSnapshot, CHART_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="px-6 py-6 space-y-6">
      <FactoryOverview stations={bottlenecks} />

      <EfficiencyChart data={chartHistory} />

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
