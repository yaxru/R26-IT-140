export default function SettingsPage() {
  const sections = [
    {
      title: "Factory Configuration",
      fields: [
        { label: "Factory Name", value: "StichFlow Main Plant", type: "text" },
        { label: "Working Hours Start", value: "06:00", type: "time" },
        { label: "Working Hours End", value: "18:00", type: "time" },
        { label: "Target Daily Output (pcs)", value: "1500", type: "number" },
      ],
    },
    {
      title: "Polling & Alerts",
      fields: [
        {
          label: "Bottleneck Poll Interval (ms)",
          value: "500",
          type: "number",
        },
        {
          label: "Efficiency Alert Threshold (%)",
          value: "65",
          type: "number",
        },
        { label: "Alert Email", value: "manager@stichflow.io", type: "email" },
      ],
    },
    {
      title: "Appearance",
      fields: [
        { label: "Default Theme", value: "dark", type: "select" },
        { label: "Date Format", value: "DD/MM/YYYY", type: "text" },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div>
        <p className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
          Settings
        </p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          System Settings
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sections.map((section) => (
          <div
            key={section.title}
            className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-5"
          >
            <h2 className="text-xs font-semibold text-zinc-300 mb-4 pb-3 border-b border-zinc-800/60">
              {section.title}
            </h2>
            <div className="space-y-4">
              {section.fields.map((field) => (
                <div key={field.label}>
                  <label className="block text-[10px] font-mono tracking-widest text-zinc-500 uppercase mb-1.5">
                    {field.label}
                  </label>
                  <input
                    type={field.type === "select" ? "text" : field.type}
                    defaultValue={field.value}
                    disabled
                    className="w-full px-3 py-2 rounded-sm text-xs font-mono
                      bg-zinc-900 border border-zinc-700 text-zinc-400
                      disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-5">
        <h2 className="text-xs font-semibold text-zinc-300 mb-3">
          Danger Zone
        </h2>
        <div className="flex items-center justify-between p-3 border border-red-500/20 rounded-sm bg-red-500/5">
          <div>
            <p className="text-xs font-medium text-zinc-300">
              Reset Factory Data
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Clears all production and skill-matrix records. Irreversible.
            </p>
          </div>
          <button
            disabled
            className="px-3 py-1.5 text-xs font-mono text-red-400 border border-red-500/30 rounded-sm
              disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-500/10 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      <p className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono text-center">
        Settings are read-only · Backend connection coming soon
      </p>
    </div>
  );
}
