export default function ReportsPage() {
  const reports = [
    {
      name: "Daily Production Summary",
      period: "Today",
      generated: "08:00 AM",
      size: "142 KB",
    },
    {
      name: "Weekly Efficiency Report",
      period: "Last 7 days",
      generated: "Mon 06:00",
      size: "381 KB",
    },
    {
      name: "Operator Skill Matrix",
      period: "Current",
      generated: "May 8",
      size: "98 KB",
    },
    {
      name: "Bottleneck Analysis",
      period: "Last 30 days",
      generated: "May 1",
      size: "256 KB",
    },
    {
      name: "Line Utilization Report",
      period: "May 2026",
      generated: "May 1",
      size: "203 KB",
    },
  ];

  const chartBars = [68, 74, 71, 82, 79, 88, 91];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div>
        <p className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
          Reports & Analytics
        </p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Production Analytics
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Weekly chart placeholder */}
        <div className="lg:col-span-2 bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-5">
          <p className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase mb-4">
            Weekly Efficiency (%)
          </p>
          <div className="flex items-end gap-3 h-32">
            {chartBars.map((v, i) => (
              <div
                key={days[i]}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <span className="text-[9px] font-mono text-zinc-500">{v}</span>
                <div
                  className="w-full rounded-sm bg-emerald-500/70"
                  style={{ height: `${(v / 100) * 100}%` }}
                />
                <span className="text-[9px] font-mono text-zinc-600">
                  {days[i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* KPI cards */}
        <div className="flex flex-col gap-4">
          {[
            { label: "Avg Daily Output", value: "1,248", unit: "pcs" },
            { label: "Overall Efficiency", value: "79%", unit: "" },
            { label: "On-time Delivery", value: "94%", unit: "" },
          ].map(({ label, value, unit }) => (
            <div
              key={label}
              className="flex-1 bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-4"
            >
              <p className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase mb-1">
                {label}
              </p>
              <p className="text-2xl font-bold font-mono text-zinc-100">
                {value} <span className="text-sm text-zinc-500">{unit}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Reports list */}
      <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800/60">
          <p className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
            Available Reports
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800/60">
              {["Report Name", "Period", "Generated", "Size"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-[10px] font-mono tracking-widest text-zinc-500 uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {reports.map((r) => (
              <tr
                key={r.name}
                className="hover:bg-zinc-800/20 transition-colors"
              >
                <td className="px-4 py-3 text-xs text-zinc-200">{r.name}</td>
                <td className="px-4 py-3 text-xs text-zinc-400">{r.period}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                  {r.generated}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                  {r.size}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono text-center">
        Placeholder data · Backend connection coming soon
      </p>
    </div>
  );
}
