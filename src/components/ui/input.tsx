import * as React from "react"

import { cn } from "@/lib/utils"
import { PasswordRevealButton } from "@/components/ui/password-reveal-button"

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  const [revealed, setRevealed] = React.useState(false)
  const isPassword = type === "password"
  const effectiveType = isPassword ? (revealed ? "text" : "password") : type

  const inputEl = (
    <input
      data-slot="input"
      type={effectiveType}
      className={cn(
        "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        isPassword && "pr-9",
        className,
      )}
      {...props}
    />
  )

  // Passwortfelder bekommen einen "Anzeigen"-Toggle (Auge) — Tippfehler-Korrektur.
  if (!isPassword) return inputEl
  return (
    <div className="relative w-full">
      {inputEl}
      <PasswordRevealButton revealed={revealed} onToggle={() => setRevealed(v => !v)} />
    </div>
  )
}

export { Input }
