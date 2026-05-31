export default function StyleManagementPage() {
  const styles = [
    {
      ref: "#4421",
      name: "Classic Polo Shirt",
      category: "Tops",
      smv: 18.4,
      lines: 2,
      status: "active",
    },
    {
      ref: "#3310",
      name: "Denim Jacket – Washed",
      category: "Outerwear",
      smv: 42.1,
      lines: 1,
      status: "active",
    },
    {
      ref: "#5502",
      name: "Basic T-Shirt",
      category: "Tops",
      smv: 8.2,
      lines: 3,
      status: "active",
    },
    {
      ref: "#2210",
      name: "Pullover Hoodie",
      category: "Knitwear",
      smv: 31.7,
      lines: 1,
      status: "completed",
    },
    {
      ref: "#6601",
      name: "Cargo Trousers",
      category: "Bottoms",
      smv: 28.9,
      lines: 0,
      status: "pending",
    },
  ];

  const statusStyle: Record<string, string> = {
    active: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    completed: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    pending: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  };

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div>
        <p className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
          Style Management
        </p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Style & SAM Reference
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Styles", value: "5" },
          { label: "Active", value: "3" },
          { label: "Avg SMV", value: "25.9" },
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
              {["Ref", "Style Name", "Category", "SMV", "Lines", "Status"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] font-mono tracking-widest text-zinc-500 uppercase"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {styles.map((s) => (
              <tr
                key={s.ref}
                className="hover:bg-zinc-800/20 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                  {s.ref}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-200 font-medium">
                  {s.name}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">
                  {s.category}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-300">
                  {s.smv}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                  {s.lines}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${statusStyle[s.status]}`}
                  >
                    {s.status}
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
