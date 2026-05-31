export default function LiveMonitoringPage() {
  const mockStations = [
    { id: "ST-01", status: "running", efficiency: 91 },
    { id: "ST-02", status: "bottleneck", efficiency: 54 },
    { id: "ST-03", status: "running", efficiency: 88 },
    { id: "ST-04", status: "idle", efficiency: 0 },
    { id: "ST-05", status: "running", efficiency: 76 },
    { id: "ST-06", status: "bottleneck", efficiency: 47 },
  ];

  const statusColor: Record<string, string> = {
    running: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    bottleneck: "text-red-400 bg-red-500/10 border-red-500/20",
    idle: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
  };

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
            Live Monitoring
          </p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Real-time Station Status
          </h1>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          LIVE
        </span>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Running", value: "4", color: "text-emerald-500" },
          { label: "Bottlenecks", value: "2", color: "text-red-400" },
          { label: "Idle", value: "1", color: "text-zinc-400" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-4"
          >
            <p className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase mb-1">
              {label}
            </p>
            <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Station cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockStations.map((s) => (
          <div
            key={s.id}
            className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-mono font-semibold text-zinc-100">
                {s.id}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${statusColor[s.status]}`}
              >
                {s.status}
              </span>
            </div>
            <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase mb-1">
              Efficiency
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${s.status === "bottleneck" ? "bg-red-400" : s.status === "idle" ? "bg-zinc-600" : "bg-emerald-500"}`}
                  style={{ width: `${s.efficiency}%` }}
                />
              </div>
              <span className="text-xs font-mono text-zinc-400">
                {s.efficiency}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono text-center">
        Placeholder data · Live backend connection coming soon
      </p>
    </div>
  );
}
