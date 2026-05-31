interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 px-4 py-3 text-sm font-mono text-red-600 dark:text-red-400">
      <span className="shrink-0 mt-px text-red-500">⚠</span>
      <span>{message}</span>
    </div>
  );
}
