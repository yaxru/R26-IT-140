import Link from "next/link";

export default function ModelNotesPage() {
  return (
    <main className="min-h-screen bg-[#F8F8F8] dark:bg-[#030C08] flex flex-col text-[#242424] dark:text-zinc-200">

      {/* ── Header ── */}
      <section className="bg-white dark:bg-[#111113] border-b border-[#EAEAEA] dark:border-zinc-800 px-6 lg:px-8 py-6 flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-widest text-[#9A9A9A] dark:text-zinc-500 mb-1">
            Research / Method Notes
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#242424] dark:text-zinc-100">Model Notes</h1>
          <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 mt-1.5 leading-relaxed">
            A clear reference for the model inputs, outputs and the decision boundary used in this module.
          </p>
        </div>
        <Link href="/production-time" className="text-[10px] font-mono text-[#9A9A9A] hover:text-[#242424] dark:hover:text-zinc-200 uppercase tracking-widest shrink-0 mt-1">
          ← Overview
        </Link>
      </section>

      {/* ── Note cards ── */}
      <section className="flex-1 bg-white dark:bg-[#111113]">
        <div className="px-6 py-4 border-b border-[#EAEAEA] dark:border-zinc-800 bg-[#F8F8F8] dark:bg-zinc-900/40">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#5F5F5F] dark:text-zinc-400">
            Model pipeline · Random Forest / 500 trees · R26-IT-140 / IT22202154
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#EAEAEA] dark:divide-zinc-800 border-b border-[#EAEAEA] dark:border-zinc-800">
          {/* Note 01 */}
          <div className="p-6 lg:p-8 flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <span className="font-mono text-[10px] font-bold text-[#9A9A9A] dark:text-zinc-500 uppercase tracking-widest">01</span>
              <div className="px-2 py-0.5 bg-[#E6F1EC] dark:bg-[#0A321E] text-[10px] font-bold text-[#1A7C4B] dark:text-[#47966F] uppercase tracking-widest">
                Input signals · 08
              </div>
            </div>
            <h2 className="text-base font-bold text-[#242424] dark:text-zinc-100">Capture the shift</h2>
            <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 leading-relaxed">
              The supervisor enters department, team number, batch quantity, production date, workers, overtime, SMV and machine breakdown minutes. These 8 signals describe the current shift profile used as direct model inputs.
            </p>
          </div>

          {/* Note 02 */}
          <div className="p-6 lg:p-8 flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <span className="font-mono text-[10px] font-bold text-[#9A9A9A] dark:text-zinc-500 uppercase tracking-widest">02</span>
              <div className="px-2 py-0.5 bg-[#E6F1EC] dark:bg-[#0A321E] text-[10px] font-bold text-[#1A7C4B] dark:text-[#47966F] uppercase tracking-widest">
                Model · Random Forest / 500 trees
              </div>
            </div>
            <h2 className="text-base font-bold text-[#242424] dark:text-zinc-100">Predict the risk</h2>
            <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 leading-relaxed">
              The trained Random Forest regression pipeline estimates productivity. The API then derives efficiency level (High / Medium / Low), delay outlook (On-time / Slight Delay / Delayed) and expected completion time.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#EAEAEA] dark:divide-zinc-800">
          {/* Note 03 */}
          <div className="p-6 lg:p-8 flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <span className="font-mono text-[10px] font-bold text-[#9A9A9A] dark:text-zinc-500 uppercase tracking-widest">03</span>
              <div className="px-2 py-0.5 bg-[#FDFBF8] dark:bg-amber-950/30 text-[10px] font-bold text-[#CE8E33] dark:text-[#D7A45A] uppercase tracking-widest border border-[#CE8E33]/20">
                Table · prediction_runs
              </div>
            </div>
            <h2 className="text-base font-bold text-[#242424] dark:text-zinc-100">Store the evidence</h2>
            <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 leading-relaxed">
              Each successful request is recorded in Supabase with its input profile and output values, creating a traceable history for review. The <span className="font-mono text-[10px]">prediction_runs</span> table preserves every signal the model has seen.
            </p>
          </div>

          {/* Note 04 */}
          <div className="p-6 lg:p-8 flex flex-col gap-3 bg-[#F8F8F8] dark:bg-zinc-900/20">
            <div className="flex items-start justify-between">
              <span className="font-mono text-[10px] font-bold text-[#9A9A9A] dark:text-zinc-500 uppercase tracking-widest">04</span>
              <div className="px-2 py-0.5 bg-[#242424] dark:bg-zinc-100 text-[10px] font-bold text-white dark:text-[#242424] uppercase tracking-widest">
                Project · R26-IT-140 / IT22202154
              </div>
            </div>
            <h2 className="text-base font-bold text-[#242424] dark:text-zinc-100">Act before the miss</h2>
            <p className="text-xs text-[#5F5F5F] dark:text-zinc-400 leading-relaxed">
              Use the productivity score, delay classification and completion estimate as an early operational signal. The model supports a supervisor decision; it does not replace floor judgement.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
