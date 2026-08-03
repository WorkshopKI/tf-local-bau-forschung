"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { Check, Minus } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Tri-State-Checkbox. `checked="indeterminate"` zeigt einen Balken statt eines
 * Hakens — „teilweise" muss auf einen Blick von „ganz" unterscheidbar sein,
 * sonst ist die Tri-State-Anzeige wertlos.
 */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-[14px] shrink-0 rounded-[3px] border-[1.5px] border-[var(--tf-border-hover)] bg-transparent outline-none transition-colors",
        "hover:border-[var(--tf-text-tertiary)]",
        "focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)] focus-visible:ring-offset-1",
        "data-checked:border-[var(--tf-primary)] data-checked:bg-[var(--tf-primary)]",
        "data-indeterminate:border-[var(--tf-primary)] data-indeterminate:bg-[var(--tf-primary)]",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-[var(--tf-primary-foreground)]"
      >
        {props.checked === "indeterminate" ? (
          <Minus size={11} strokeWidth={3.5} />
        ) : (
          <Check size={11} strokeWidth={3.5} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
