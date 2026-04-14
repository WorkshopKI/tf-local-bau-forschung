import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { LS_KEYS } from "@/lib/constants";
import type { AIRoutingConfig } from "@/types";

interface PlaygroundHeaderProps {
  mode: "einsteiger" | "experte";
  onModeChange: (mode: "einsteiger" | "experte") => void;
  onStartTour?: () => void;
  canUseExternal: boolean;
  promptConfidentiality: "open" | "internal" | "confidential";
  aiTier: "internal" | "external";
  aiRouting: AIRoutingConfig;
}

export function PlaygroundHeader({
  mode,
  onModeChange,
  onStartTour,
  canUseExternal,
  promptConfidentiality,
  aiTier,
  aiRouting,
}: PlaygroundHeaderProps) {
  const tourCompleted = localStorage.getItem(LS_KEYS.TOUR_COMPLETED) === "true";
  const { state } = useSidebar();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="flex items-center h-12 px-4">
        <div className="flex items-center gap-3">
          {state === "expanded" && <SidebarTrigger />}
          <h1 className="text-base font-bold tracking-tight">Prompt Werkstatt</h1>
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => onModeChange("einsteiger")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                mode === "einsteiger" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              Einsteiger
            </button>
            <button
              onClick={() => onModeChange("experte")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                mode === "experte" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              Experte
            </button>
          </div>
        </div>
        <div className="ml-auto">
          {onStartTour && (
            <Button
              variant="outline"
              size="sm"
              onClick={onStartTour}
              className="text-xs h-8 gap-1.5 hidden sm:flex"
            >
              <span className="text-primary">▷</span>
              Neu hier? So geht's
              {!tourCompleted && (
                <span className="relative flex h-2 w-2 ml-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
              )}
            </Button>
          )}
        </div>
      </div>

    </header>
  );
}
