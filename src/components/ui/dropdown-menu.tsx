/**
 * DropdownMenu — in der Machart von [context-menu.tsx](./context-menu.tsx):
 * App-Tokens statt shadcn-Farben, 0,5-px-Kante, **keine** Ein-/Ausblend-
 * Animation.
 *
 * Die generierte shadcn-Fassung trug `animate-in`/`animate-out`. Gemessen im
 * Bedingungs-Editor (11.09.2026): nach der Auswahl eines Eintrags stand das
 * geschlossene Menü noch über eine Sekunde im DOM — `data-state="closed"`,
 * volle Deckkraft, `pointer-events: auto` —, weil Radix mit dem Aushängen auf
 * das Ende der Ausblend-Animation wartet. Der DESIGN_GUIDE erlaubt Animation
 * ohnehin nur bei Dialogen (Kap. 7). Übernommen sind nur die Teile, die hier
 * gebraucht werden.
 */
import * as React from "react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
  )
}

function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[180px] max-h-(--radix-dropdown-menu-content-available-height) overflow-y-auto",
          "rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] p-1 shadow-md outline-hidden",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  variant?: "default" | "danger"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-[5px] px-2 py-1.5 text-[12.5px] outline-hidden select-none",
        "text-[var(--tf-text)] data-highlighted:bg-[var(--tf-hover)]",
        "data-disabled:pointer-events-none data-disabled:opacity-40",
        "data-[variant=danger]:text-[var(--tf-danger-text)]",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("my-1 h-px bg-[var(--tf-border)]", className)}
      {...props}
    />
  )
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn("px-2 py-1 text-[11px] text-[var(--tf-text-tertiary)]", className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
}
