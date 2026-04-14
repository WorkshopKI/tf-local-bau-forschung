import { useState, useCallback } from "react";
import { LS_KEYS } from "@/lib/constants";

interface UseTourReturn {
  /** Aktiver Schritt-Index (null = Tour nicht aktiv) */
  activeStep: number | null;
  /** Tour starten */
  start: () => void;
  /** Zum nächsten Schritt */
  next: () => void;
  /** Zum vorherigen Schritt */
  prev: () => void;
  /** Tour beenden */
  finish: () => void;
  /** Gesamtanzahl Schritte */
  totalSteps: number;
  /** Tour aktiv? */
  isActive: boolean;
  /** Wurde die Tour schon einmal abgeschlossen? */
  hasCompleted: boolean;
}

export function useTour(totalSteps: number): UseTourReturn {
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [hasCompleted, setHasCompleted] = useState(() => {
    return localStorage.getItem(LS_KEYS.TOUR_COMPLETED) === "true";
  });

  const start = useCallback(() => setActiveStep(0), []);

  const next = useCallback(() => {
    setActiveStep((prev) => {
      if (prev === null) return null;
      if (prev >= totalSteps - 1) {
        localStorage.setItem(LS_KEYS.TOUR_COMPLETED, "true");
        setHasCompleted(true);
        return null;
      }
      return prev + 1;
    });
  }, [totalSteps]);

  const prev = useCallback(() => {
    setActiveStep((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
  }, []);

  const finish = useCallback(() => {
    setActiveStep(null);
    localStorage.setItem(LS_KEYS.TOUR_COMPLETED, "true");
    setHasCompleted(true);
  }, []);

  return {
    activeStep,
    start,
    next,
    prev,
    finish,
    totalSteps,
    isActive: activeStep !== null,
    hasCompleted,
  };
}
