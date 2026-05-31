export default function MaintenancePage() {
  const tickets = [
    {
      id: "MNT-041",
      machine: "Overlock #3 – LINE-A",
      issue: "Thread breakage, tension irregular",
      priority: "high",
      assigned: "Tech. Ruwan",
      status: "in-progress",
    },
    {
      id: "MNT-040",
      machine: "Flatlock #1 – LINE-B",
      issue: "Needle bar misalignment",
      priority: "high",
      assigned: "Tech. Amali",
      status: "open",
    },
    {
      id: "MNT-039",
      machine: "Button Attach #2 – LINE-C",
      issue: "Scheduled 500hr service",
      priority: "low",
      assigned: "Tech. Ruwan",
      status: "scheduled",
    },
    {
      id: "MNT-038",
      machine: "Steam Press – LINE-D",
      issue: "Pressure drop below threshold",
      priority: "medium",
      assigned: "Tech. Priya",
      status: "resolved",
    },
    {
      id: "MNT-037",
      machine: "Hemming #4 – LINE-A",
      issue: "Blade replacement overdue",
      priority: "medium",
      assigned: "Tech. Amali",
      status: "resolved",
    },
  ];

  const priorityStyle: Record<string, string> = {
    high: "text-red-400 bg-red-500/10 border-red-500/20",
    medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    low: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  };

  const statusStyle: Record<string, string> = {
    open: "text-red-400 bg-red-500/10 border-red-500/20",
    "in-progress": "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    scheduled: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    resolved: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  };

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div>
        <p className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
          Maintenance
        </p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Machine Maintenance
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Open Tickets", value: "2" },
          { label: "In Progress", value: "1" },
          { label: "Scheduled", value: "1" },
          { label: "Resolved This Week", value: "2" },
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

      {/* Tickets table */}
      <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800/60">
              {[
                "Ticket",
                "Machine",
                "Issue",
                "Priority",
                "Assigned To",
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
            {tickets.map((t) => (
              <tr key={t.id} className="hover:bg-zinc-800/20 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                  {t.id}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-300">{t.machine}</td>
                <td className="px-4 py-3 text-xs text-zinc-400 max-w-48 truncate">
                  {t.issue}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${priorityStyle[t.priority]}`}
                  >
                    {t.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">
                  {t.assigned}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${statusStyle[t.status]}`}
                  >
                    {t.status.replace("-", " ")}
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
