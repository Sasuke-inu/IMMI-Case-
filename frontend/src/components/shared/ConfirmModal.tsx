import { useEffect, useRef } from "react"
import { AlertTriangle } from "lucide-react"

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  variant?: "danger" | "default"
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onCancel])

  if (!open) return null

  const isDanger = variant === "danger"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="flex items-start gap-3">
          {isDanger && (
            <div className="rounded-full bg-danger/10 p-2">
              <AlertTriangle className="h-5 w-5 text-danger" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-text">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-surface"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={
              isDanger
                ? "rounded-md bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90"
                : "rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
