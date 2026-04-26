import * as React from "react"

import { cn } from "@/lib/utils"

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  className?: string
  /**
   * Klick auf das Overlay (graue Flaeche) schliesst den Dialog. Default `true`.
   * Fuer lange Bearbeitungs-Dialoge (Wizards) auf `false` setzen, damit
   * versehentliche Klicks beim Wechsel zu anderen Anwendungen nicht den
   * Wizard-State zerstoeren. Escape und expliziter Schliessen-Button
   * bleiben unabhaengig wirksam.
   */
  dismissOnOverlayClick?: boolean
}

function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  dismissOnOverlayClick = true,
}: DialogProps) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4",
        dismissOnOverlayClick ? null : "cursor-default",
      )}
      onClick={dismissOnOverlayClick ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        data-slot="dialog"
        className={cn(
          "flex w-full max-w-[480px] max-h-[calc(100vh-2rem)] flex-col rounded-2xl bg-[var(--tf-bg)] shadow-[0_8px_30px_rgba(0,0,0,0.12)]",
          className,
        )}
        style={{ border: "0.5px solid var(--tf-border)" }}
        onClick={e => e.stopPropagation()}
      >
        {title ? (
          <div className="flex-shrink-0 px-6 pt-6 mb-2 text-[15px] font-medium text-[var(--tf-text)]">{title}</div>
        ) : null}
        {description ? (
          <div className="flex-shrink-0 px-6 mb-4 text-[13px] text-[var(--tf-text-secondary)]">{description}</div>
        ) : null}
        <div
          className={cn(
            "flex-1 min-h-0 overflow-y-auto px-6",
            !title && !description ? "pt-6" : null,
            !footer ? "pb-6" : null,
          )}
        >
          {children}
        </div>
        {footer ? (
          <div className="flex-shrink-0 px-6 pb-6 pt-4 flex items-center justify-end gap-2">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}

export { Dialog }
