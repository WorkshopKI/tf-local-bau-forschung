import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

/** Karten-Breite. `md` (Default) = heutiger Wert; groessere Stufen fuer inhaltsreiche Dialoge. */
const SIZE_CLASS: Record<NonNullable<DialogProps["size"]>, string> = {
  sm: "max-w-[400px]",
  md: "max-w-[480px]",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
}

/** Default-Startbreite (px) pro Groesse fuer den resizable-Modus (entspricht den max-w-Klassen). */
const SIZE_PX: Record<NonNullable<DialogProps["size"]>, number> = {
  sm: 400,
  md: 480,
  lg: 672,
  xl: 896,
}

interface SavedSize {
  w: number
  h: number
}

/** Gemerkte Dialog-Groesse aus localStorage lesen (oder null). */
function readSavedSize(key?: string): SavedSize | null {
  if (!key || typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<SavedSize>
    if (typeof p?.w === "number" && typeof p?.h === "number") return { w: p.w, h: p.h }
  } catch {
    /* defekter Eintrag → Default */
  }
  return null
}

/** Vertikale Ausrichtung im Overlay. `center` (Default) = heutiges Verhalten; `top` fuer Dialoge mit stark schwankender Hoehe. */
const ALIGN_CLASS: Record<NonNullable<DialogProps["align"]>, string> = {
  center: "items-center",
  top: "items-start pt-[8vh]",
}

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
  /** Karten-Breite. Default `md` (= heutiger Wert, keine Regression). */
  size?: "sm" | "md" | "lg" | "xl"
  /**
   * Macht die Karte per Maus frei groessenveraenderbar (natives CSS `resize`, Ecke unten
   * rechts). Default `false` (keine Regression). Ersetzt im aktivierten Fall die Breiten-/
   * Hoehen-Klassen durch Inline-Werte (Grenzen ~360x280 bis 95vw/95vh).
   */
  resizable?: boolean
  /**
   * localStorage-Schluessel, unter dem die zuletzt gewaehlte Groesse gemerkt und beim
   * naechsten Oeffnen wiederhergestellt wird (nur wirksam mit `resizable`).
   */
  resizeStorageKey?: string
  /**
   * Vertikale Ausrichtung. Default `center` (heutiges `items-center`).
   * `top` rendert `items-start pt-[8vh]` fuer inhaltsreiche Dialoge, deren
   * Hoehe stark schwankt. Hoehen-Cap + interner Scroll gelten unveraendert.
   */
  align?: "center" | "top"
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
  size = "md",
  align = "center",
  resizable = false,
  resizeStorageKey,
}: DialogProps) {
  const cardRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Resizable-Modus: Start-Groesse aus localStorage (sonst Default), Inline-Style steuert
  // Breite/Hoehe + Grenzen; die Breiten-/max-h-Klassen entfallen, damit sie nicht klemmen.
  const resizeStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    if (!resizable) return undefined
    const saved = readSavedSize(resizeStorageKey)
    const vh = typeof window !== "undefined" ? window.innerHeight : 800
    return {
      width: saved?.w ?? SIZE_PX[size],
      height: saved?.h ?? Math.round(Math.min(vh * 0.8, vh - 32)),
      minWidth: 360,
      minHeight: 280,
      maxWidth: "95vw",
      maxHeight: "95vh",
      resize: "both",
      overflow: "hidden",
    }
    // `open` mitgefuehrt: bei jedem Oeffnen die gemerkte Groesse frisch lesen.
  }, [resizable, resizeStorageKey, size, open])

  // Gewaehlte Groesse beim Resizen merken.
  React.useEffect(() => {
    if (!open || !resizable || !resizeStorageKey) return
    const el = cardRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      try {
        localStorage.setItem(resizeStorageKey, JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height) }))
      } catch {
        /* localStorage voll/blockiert → Groesse wird nicht gemerkt */
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, resizable, resizeStorageKey])

  if (!open) return null

  return (
    <div
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-[80] flex justify-center bg-black/40 p-4",
        ALIGN_CLASS[align],
        dismissOnOverlayClick ? null : "cursor-default",
      )}
      onClick={dismissOnOverlayClick ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={cardRef}
        data-slot="dialog"
        className={cn(
          "flex flex-col rounded-2xl bg-[var(--tf-bg)] shadow-[0_8px_30px_rgba(0,0,0,0.12)]",
          // Im resizable-Modus steuert der Inline-Style Breite/Hoehe; sonst die Klassen.
          resizable ? null : cn("w-full max-h-[calc(100vh-2rem)]", SIZE_CLASS[size]),
          className,
        )}
        style={{ border: "0.5px solid var(--tf-border)", ...resizeStyle }}
        onClick={e => e.stopPropagation()}
      >
        {title ? (
          <div className="flex-shrink-0 flex items-start gap-3 px-6 pt-6 mb-2">
            <div className="flex-1 text-[15px] font-medium text-[var(--tf-text)]">{title}</div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="-mr-1.5 -mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-[var(--tf-text-tertiary)] transition hover:bg-[var(--tf-bg-secondary)] hover:text-[var(--tf-text)]"
            >
              <X size={16} />
            </button>
          </div>
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
