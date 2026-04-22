import * as React from "react"

import { cn } from "@/lib/utils"

type AlertVariant = "info" | "warning" | "danger"

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  info: "bg-[var(--tf-info-bg,hsl(210,80%,95%))] text-[var(--tf-info-text,hsl(210,70%,30%))]",
  warning: "bg-[var(--tf-warning-bg,hsl(38,90%,93%))] text-[var(--tf-warning-text,hsl(38,70%,30%))]",
  danger: "bg-[var(--tf-danger-bg,hsl(0,70%,95%))] text-[var(--tf-danger-text,hsl(0,60%,38%))]",
}

interface AlertProps extends React.ComponentProps<"div"> {
  variant?: AlertVariant
}

function Alert({ className, variant = "info", children, ...props }: AlertProps) {
  return (
    <div
      data-slot="alert"
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-[12.5px]",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Alert }
