export default function ProductionLinesPage() {
  const lines = [
    {
      id: "LINE-A",
      style: "Polo Shirt – Ref #4421",
      target: 320,
      actual: 298,
      operators: 14,
      status: "on-track",
    },
    {
      id: "LINE-B",
      style: "Denim Jacket – Ref #3310",
      target: 180,
      actual: 121,
      operators: 10,
      status: "behind",
    },
    {
      id: "LINE-C",
      style: "T-Shirt – Ref #5502",
      target: 500,
      actual: 487,
      operators: 18,
      status: "on-track",
    },
    {
      id: "LINE-D",
      style: "Hoodie – Ref #2210",
      target: 240,
      actual: 240,
      operators: 12,
      status: "complete",
    },
  ];

  const statusStyle: Record<string, string> = {
    "on-track": "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
    behind: "text-red-400 border-red-500/30 bg-red-500/10",
    complete: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  };

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div>
        <p className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
          Production Lines
        </p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Active Production Lines
        </h1>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Lines", value: "4" },
          { label: "On Track", value: "2" },
          { label: "Behind Schedule", value: "1" },
          { label: "Completed Today", value: "1" },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-4"
          >
            <p className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase mb-1">
              {label}
            </p>
            <p className="text-2xl font-bold font-mono text-zinc-100">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Lines table */}
      <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800/60">
              {[
                "Line",
                "Style",
                "Target",
                "Actual",
                "Progress",
                "Operators",
                "Status",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[10px] font-mono tracking-widest text-zinc-500 uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {lines.map((l) => (
              <tr key={l.id} className="hover:bg-zinc-800/20 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-zinc-300">
                  {l.id}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">{l.style}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                  {l.target}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-300">
                  {l.actual}
                </td>
                <td className="px-4 py-3 w-32">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{
                          width: `${Math.min(100, Math.round((l.actual / l.target) * 100))}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 w-8 text-right">
                      {Math.round((l.actual / l.target) * 100)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                  {l.operators}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${statusStyle[l.status]}`}
                  >
                    {l.status.replace("-", " ")}
                  </span>
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
