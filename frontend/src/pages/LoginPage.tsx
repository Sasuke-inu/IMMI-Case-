import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TelegramLoginButton } from "@/components/auth/TelegramLoginButton";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/shared/PageLoader";

const BOT_NAME = import.meta.env.VITE_TELEGRAM_BOT_NAME || "immi_case_bot";

export function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleSuccess = useCallback(() => navigate("/", { replace: true }), [navigate]);
  const handleError = useCallback((err: Error) => setLoginError(err.message), []);

  if (isLoading) return <PageLoader />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <div className="max-w-md w-full p-8 rounded-xl shadow-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
        <h1 className="text-2xl font-bold text-[var(--color-heading)] mb-2 font-serif">
          IMMI Case
        </h1>
        <p className="text-[var(--color-text-secondary)] mb-8 text-sm">
          Australian immigration tribunal case research platform. Sign in with
          Telegram to save searches and collections.
        </p>
        {loginError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {loginError}
          </div>
        )}
        <div className="flex justify-center">
          <TelegramLoginButton
            botName={BOT_NAME}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        </div>
        <p className="mt-6 text-xs text-[var(--color-text-muted)] text-center">
          All 149,016 cases are publicly accessible without login. Login is only
          required to save searches and collections.
        </p>
      </div>
    </div>
  );
}
