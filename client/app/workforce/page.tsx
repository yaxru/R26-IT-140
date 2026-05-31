export default function WorkforcePage() {
  const workers = [
    {
      id: "OP-001",
      name: "Amara Silva",
      skill: "Overlock",
      grade: "A",
      line: "LINE-A",
      status: "active",
    },
    {
      id: "OP-002",
      name: "Dinesh Kumar",
      skill: "Flatlock",
      grade: "B",
      line: "LINE-B",
      status: "active",
    },
    {
      id: "OP-003",
      name: "Fatima Noor",
      skill: "Button Attach",
      grade: "A",
      line: "LINE-C",
      status: "break",
    },
    {
      id: "OP-004",
      name: "Kasun Perera",
      skill: "Overlock",
      grade: "C",
      line: "LINE-A",
      status: "active",
    },
    {
      id: "OP-005",
      name: "Nimalka Ratna",
      skill: "Hemming",
      grade: "B",
      line: "LINE-D",
      status: "absent",
    },
    {
      id: "OP-006",
      name: "Rohan Mendis",
      skill: "Flatlock",
      grade: "A",
      line: "LINE-C",
      status: "active",
    },
  ];

  const statusStyle: Record<string, string> = {
    active: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    break: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    absent: "text-red-400 bg-red-500/10 border-red-500/20",
  };

  const gradeColor: Record<string, string> = {
    A: "text-emerald-400",
    B: "text-blue-400",
    C: "text-yellow-400",
  };

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div>
        <p className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
          Workforce
        </p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Operator Management
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Operators", value: "6" },
          { label: "Active", value: "4" },
          { label: "On Break", value: "1" },
          { label: "Absent", value: "1" },
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

      {/* Table */}
      <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800/60">
              {[
                "ID",
                "Name",
                "Primary Skill",
                "Grade",
                "Assigned Line",
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
            {workers.map((w) => (
              <tr key={w.id} className="hover:bg-zinc-800/20 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                  {w.id}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-200 font-medium">
                  {w.name}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">{w.skill}</td>
                <td
                  className={`px-4 py-3 font-mono text-xs font-bold ${gradeColor[w.grade]}`}
                >
                  {w.grade}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                  {w.line}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${statusStyle[w.status]}`}
                  >
                    {w.status}
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
