interface ApiErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ApiErrorState({
  title = "Unable to load data",
  message = "Please try again. If this keeps happening, check API/backend connectivity.",
  onRetry,
}: ApiErrorStateProps) {
  return (
    <div className="rounded-lg border border-red-300/40 bg-red-50/40 p-4 text-sm dark:border-red-500/30 dark:bg-red-900/15">
      <p className="font-semibold text-red-800 dark:text-red-200">{title}</p>
      <p className="mt-1 text-red-700/90 dark:text-red-200/90">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-red-600/30 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100/70 dark:border-red-300/30 dark:text-red-200 dark:hover:bg-red-900/30"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
