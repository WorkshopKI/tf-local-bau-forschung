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
}

function Dialog({ open, onClose, title, description, children, footer, className }: DialogProps) {
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
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        data-slot="dialog"
        className={cn(
          "w-full max-w-[480px] rounded-2xl bg-[var(--tf-bg)] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)]",
          className,
        )}
        style={{ border: "0.5px solid var(--tf-border)" }}
        onClick={e => e.stopPropagation()}
      >
        {title ? (
          <div className="mb-2 text-[15px] font-medium text-[var(--tf-text)]">{title}</div>
        ) : null}
        {description ? (
          <div className="mb-4 text-[13px] text-[var(--tf-text-secondary)]">{description}</div>
        ) : null}
        <div>{children}</div>
        {footer ? <div className="mt-5 flex items-center justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  )
}

export { Dialog }
