import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tag } from "lucide-react";

interface TagInputModalProps {
  open: boolean;
  count: number;
  onConfirm: (tag: string) => void;
  onCancel: () => void;
}

export function TagInputModal({
  open,
  count,
  onConfirm,
  onCancel,
}: TagInputModalProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue("");
      // Defer focus so the modal is fully mounted first
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && value.trim()) {
        onConfirm(value.trim());
        setValue("");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, value, onConfirm, onCancel]);

  if (!open) return null;

  const trimmed = value.trim();
  const nearLimit = value.length >= 40;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-[#111820]/65" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-accent/10 p-2">
            <Tag className="h-5 w-5 text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">
              {t("modals.tag_input_title")}
            </h3>
            <p className="mt-1 text-sm text-muted-text">
              {t("modals.tag_input_message", { count })}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("modals.tag_input_placeholder")}
            maxLength={50}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {nearLimit && (
            <p className="mt-1 text-right text-xs text-muted-text">
              {value.length}/50
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-surface"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={() => {
              if (!trimmed) return;
              onConfirm(trimmed);
              setValue("");
            }}
            disabled={!trimmed}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50"
          >
            {t("modals.tag_input_confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
