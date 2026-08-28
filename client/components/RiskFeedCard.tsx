import type { RiskNotification } from "../types";

interface RiskFeedCardProps {
  notifications: RiskNotification[];
  onMarkRead: (id: number) => void;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function RiskFeedCard({ notifications, onMarkRead }: RiskFeedCardProps) {
  return (
    <div className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 p-5 flex flex-col gap-4">
      <span className="text-[10px] font-mono tracking-widest text-zinc-400 dark:text-zinc-500 uppercase">
        Risk &amp; Flag Feed
      </span>

      {notifications.length === 0 ? (
        <p className="text-[11px] font-mono text-zinc-400 dark:text-zinc-600 py-6 text-center">
          No alerts yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`p-3 border text-[11px] font-mono ${
                n.is_read
                  ? "border-zinc-100 dark:border-zinc-800/40 bg-zinc-50 dark:bg-zinc-900/40"
                  : "border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-950/20"
              }`}
            >
              <p
                className={
                  n.is_read
                    ? "text-zinc-500 dark:text-zinc-500 leading-relaxed"
                    : "text-zinc-800 dark:text-zinc-200 leading-relaxed"
                }
              >
                {n.message}
              </p>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[9px] text-zinc-400 dark:text-zinc-600">
                  {timeAgo(n.created_at)}
                </span>
                {!n.is_read && (
                  <button
                    onClick={() => onMarkRead(n.id)}
                    className="text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
