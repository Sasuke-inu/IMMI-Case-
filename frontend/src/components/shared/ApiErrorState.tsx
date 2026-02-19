import { useTranslation } from "react-i18next";

interface ApiErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ApiErrorState({ title, message, onRetry }: ApiErrorStateProps) {
  const { t } = useTranslation();

  const defaultTitle = title ?? t("errors.unable_to_load_data");
  const defaultMessage = message ?? t("errors.unable_to_load_message");
  return (
    <div className="rounded-lg border border-red-300/40 bg-red-50/40 p-4 text-sm dark:border-red-500/30 dark:bg-red-900/15">
      <p className="font-semibold text-red-800 dark:text-red-200">
        {defaultTitle}
      </p>
      <p className="mt-1 text-red-700/90 dark:text-red-200/90">
        {defaultMessage}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-red-600/30 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100/70 dark:border-red-300/30 dark:text-red-200 dark:hover:bg-red-900/30"
        >
          {t("common.retry")}
        </button>
      ) : null}
    </div>
  );
}
