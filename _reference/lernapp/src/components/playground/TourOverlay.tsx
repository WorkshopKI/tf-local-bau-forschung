import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TourStep } from "./tourSteps";

interface TourOverlayProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onFinish: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;

export function TourOverlay({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onFinish,
}: TourOverlayProps) {
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Track the elevated element so cleanup always restores styles
  const elevatedRef = useRef<{ el: HTMLElement; origPosition: string; origZIndex: string } | null>(null);

  // Elevate the target element above the overlay so it stays interactive
  useEffect(() => {
    // Restore previous element styles on step change
    if (elevatedRef.current) {
      const { el: prev, origPosition, origZIndex } = elevatedRef.current;
      prev.style.position = origPosition;
      prev.style.zIndex = origZIndex;
      elevatedRef.current = null;
    }

    const elevate = (el: HTMLElement) => {
      const origPosition = el.style.position;
      const origZIndex = el.style.zIndex;
      const computed = window.getComputedStyle(el);
      if (computed.position === "static") el.style.position = "relative";
      el.style.zIndex = "102";
      elevatedRef.current = { el, origPosition, origZIndex };
    };

    const measureAndShow = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      });
    };

    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);

    if (!el) {
      // Sofort zentrierten Fallback anzeigen — Step wird NIE übersprungen
      setTargetRect({
        top: window.innerHeight / 2 - 25,
        left: window.innerWidth / 2 - 100,
        width: 200,
        height: 50,
      });

      // Retry bis zu 3× alle 300ms
      let attempts = 0;
      const retryInterval = setInterval(() => {
        attempts++;
        const retryEl = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
        if (retryEl) {
          clearInterval(retryInterval);
          elevate(retryEl);
          measureAndShow(retryEl);
          retryEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
          // Nachmessen nach scroll
          setTimeout(() => measureAndShow(retryEl), 400);
        } else if (attempts >= 3) {
          clearInterval(retryInterval);
        }
      }, 300);

      return () => clearInterval(retryInterval);
    }

    // Element sofort gefunden — normaler Ablauf
    elevate(el);
    measureAndShow(el);
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const timer = setTimeout(() => measureAndShow(el), 400);

    const onResize = () => measureAndShow(el);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(timer);
    };
  }, [step.target]);

  if (!targetRect) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  const getTooltipStyle = (): React.CSSProperties => {
    const pos = step.position || "bottom";
    const base: React.CSSProperties = {
      position: "fixed",
      zIndex: 110,
      maxWidth: 320,
    };

    switch (pos) {
      case "bottom":
        return {
          ...base,
          top: targetRect.top + targetRect.height + 12,
          left: Math.max(8, Math.min(targetRect.left, window.innerWidth - 336)),
        };
      case "top":
        return {
          ...base,
          bottom: window.innerHeight - targetRect.top + 12,
          left: Math.max(8, Math.min(targetRect.left, window.innerWidth - 336)),
        };
      case "right":
        return {
          ...base,
          top: Math.max(8, targetRect.top),
          left: Math.min(
            targetRect.left + targetRect.width + 12,
            window.innerWidth - 336
          ),
        };
      case "left":
        return {
          ...base,
          top: Math.max(8, targetRect.top),
          right: Math.max(8, window.innerWidth - targetRect.left + 12),
        };
      default:
        return {
          ...base,
          top: targetRect.top + targetRect.height + 12,
          left: Math.max(8, targetRect.left),
        };
    }
  };

  return (
    <>
      {/* Overlay mit Spotlight-Loch via clip-path */}
      <div
        className="fixed inset-0 z-[100] transition-all duration-300"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          clipPath: `polygon(
            0% 0%, 0% 100%,
            ${targetRect.left}px 100%,
            ${targetRect.left}px ${targetRect.top}px,
            ${targetRect.left + targetRect.width}px ${targetRect.top}px,
            ${targetRect.left + targetRect.width}px ${targetRect.top + targetRect.height}px,
            ${targetRect.left}px ${targetRect.top + targetRect.height}px,
            ${targetRect.left}px 100%,
            100% 100%, 100% 0%
          )`,
        }}
        onClick={onFinish}
      />

      {/* Spotlight-Ring um das Target */}
      <div
        className="fixed z-[105] rounded-lg ring-2 ring-primary/60 pointer-events-none transition-all duration-300"
        style={{
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
        }}
      />

      {/* Tooltip */}
      <Card
        ref={tooltipRef}
        className="fixed z-[110] p-4 shadow-xl border-primary/20 bg-card"
        style={getTooltipStyle()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-medium text-muted-foreground">
            Schritt {stepIndex + 1} von {totalSteps}
          </span>
          <button
            onClick={onFinish}
            className="text-muted-foreground hover:text-foreground p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Inhalt */}
        <h4 className="text-sm font-semibold mb-1">{step.title}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          {step.description}
        </p>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          {!isFirst && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={onPrev}
            >
              <ChevronLeft className="w-3 h-3 mr-1" /> Zurück
            </Button>
          )}
          <div className="flex-1" />
          {isLast ? (
            <Button size="sm" className="text-xs h-7" onClick={onFinish}>
              <Check className="w-3 h-3 mr-1" /> Fertig
            </Button>
          ) : (
            <Button size="sm" className="text-xs h-7" onClick={onNext}>
              Weiter <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          )}
        </div>

        {/* Fortschritts-Dots */}
        <div className="flex justify-center gap-1 mt-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                i === stepIndex
                  ? "bg-primary"
                  : i < stepIndex
                    ? "bg-primary/40"
                    : "bg-muted"
              )}
            />
          ))}
        </div>
      </Card>
    </>
  );
}
