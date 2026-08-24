interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="flex items-start gap-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 px-4 py-3 text-sm font-mono text-orange-600 dark:text-orange-400">
      <span className="shrink-0 mt-px text-orange-500">⚠</span>
      <span>{message}</span>
    </div>
  );
}
