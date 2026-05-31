export default function InventoryPage() {
  const items = [
    {
      sku: "THD-001",
      name: "Polyester Thread #40 – Black",
      category: "Thread",
      qty: 1240,
      unit: "spools",
      reorder: 200,
      status: "ok",
    },
    {
      sku: "NDL-A80",
      name: "Machine Needle – Type A, 80/12",
      category: "Needles",
      qty: 48,
      unit: "packs",
      reorder: 50,
      status: "low",
    },
    {
      sku: "ELS-WHT",
      name: "Elastic Band 20mm – White",
      category: "Trimmings",
      qty: 320,
      unit: "m",
      reorder: 100,
      status: "ok",
    },
    {
      sku: "BTN-MET",
      name: "Metal Button 15mm",
      category: "Buttons",
      qty: 8400,
      unit: "pcs",
      reorder: 2000,
      status: "ok",
    },
    {
      sku: "LBL-WVN",
      name: "Woven Label – Brand Main",
      category: "Labels",
      qty: 22,
      unit: "rolls",
      reorder: 30,
      status: "low",
    },
    {
      sku: "LIN-CTN",
      name: "Cotton Lining – Natural",
      category: "Fabric",
      qty: 0,
      unit: "m",
      reorder: 500,
      status: "out",
    },
  ];

  const statusStyle: Record<string, string> = {
    ok: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    low: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    out: "text-red-400 bg-red-500/10 border-red-500/20",
  };

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div>
        <p className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
          Inventory
        </p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Materials & Supplies
        </h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total SKUs", value: "6" },
          { label: "Low Stock", value: "2" },
          { label: "Out of Stock", value: "1" },
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
                "SKU",
                "Item",
                "Category",
                "Qty",
                "Unit",
                "Reorder At",
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
            {items.map((item) => (
              <tr
                key={item.sku}
                className="hover:bg-zinc-800/20 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                  {item.sku}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-200">{item.name}</td>
                <td className="px-4 py-3 text-xs text-zinc-400">
                  {item.category}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-300">
                  {item.qty.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">{item.unit}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                  {item.reorder.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${statusStyle[item.status]}`}
                  >
                    {item.status === "out"
                      ? "out of stock"
                      : item.status === "low"
                        ? "low stock"
                        : "in stock"}
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
