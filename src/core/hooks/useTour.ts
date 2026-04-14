import { useState, useCallback, createContext, useContext } from 'react';

/** localStorage-Key fuer den abgeschlossenen Tour-Status */
export const TOUR_STORAGE_KEY = 'teamflow_tour_completed';

export interface UseTourReturn {
  /** Aktiver Schritt-Index (null = Tour nicht aktiv) */
  activeStep: number | null;
  /** Tour starten */
  start: () => void;
  /** Zum naechsten Schritt */
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
    try {
      return localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const start = useCallback(() => setActiveStep(0), []);

  const next = useCallback(() => {
    setActiveStep(prev => {
      if (prev === null) return null;
      if (prev >= totalSteps - 1) {
        try { localStorage.setItem(TOUR_STORAGE_KEY, 'true'); } catch { /* ignore */ }
        setHasCompleted(true);
        return null;
      }
      return prev + 1;
    });
  }, [totalSteps]);

  const prev = useCallback(() => {
    setActiveStep(prev => (prev !== null && prev > 0 ? prev - 1 : prev));
  }, []);

  const finish = useCallback(() => {
    setActiveStep(null);
    try { localStorage.setItem(TOUR_STORAGE_KEY, 'true'); } catch { /* ignore */ }
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

/** Context fuer globalen Tour-Zugriff ohne Prop-Drilling */
export const TourContext = createContext<UseTourReturn | null>(null);

/** Hook zum Konsumieren des Tour-Contexts */
export function useTourContext(): UseTourReturn {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTourContext must be used within TourContext.Provider');
  return ctx;
}
