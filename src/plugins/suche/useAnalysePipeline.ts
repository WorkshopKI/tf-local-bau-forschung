/**
 * React-Hook der die KI-Analyse (Begründung-Overlay) kapselt: State +
 * Start/Cancel-API. Pipeline-Code selbst ist React-frei — hier nur das
 * State-Wiring.
 *
 * WICHTIG: KEIN Auto-`ping()` beim Mount! Streamlit-Bridge öffnet im `ping()`
 * automatisch ein neues Browser-Fenster (die konfigurierte Streamlit-URL) — das
 * würde jeden Mount der Suche-Seite zum „pop-up" machen, auch wenn der User die
 * KI-Analyse gar nicht nutzen will. Verfügbarkeit wird **lazy** beim ersten
 * Klick auf „Analyse starten" geprüft.
 *
 * Bis v4.15.0 galt das nur für den Mount: der Klick selbst pingte OFFEN
 * (`openIfNeeded` steht per Vorgabe auf `true`) und riss damit ungefragt einen
 * KI-Tab auf — sichtbar am „Warum?" einer einzelnen Zeile, das sich wie eine
 * Frage an die Liste liest und nicht wie ein Auftrag, ein Fenster zu öffnen.
 * Jetzt läuft der Guard `kiVerbindungGeprueft` davor: passiver Ping auf eine
 * BEREITS offene Bridge, sonst der app-weite Verbinden-Dialog und ein sauberer
 * Abbruch mit Hinweis.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { kiVerbindungGeprueft } from '@/core/services/ai/ki-guard';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import {
  runAnalysisPipeline,
  STAGE_LABELS,
  type PipelineProgress,
  type PipelineResult,
} from './analyse/pipeline';

export interface UseAnalysePipeline {
  providerName: string;
  running: boolean;
  progress: PipelineProgress | null;
  result: PipelineResult | null;
  /** Live-Map `id` → Begründung (füllt sich progressiv während des Laufs). */
  begruendungById: Record<string, string> | null;
  error: string | null;
  start: (question: string, results: ReadonlyArray<UnifiedSearchResult>, promptOverride: string) => void;
  cancel: () => void;
  reset: () => void;
}

const INITIAL_PROGRESS: PipelineProgress = {
  stage: 'idle',
  stageLabel: STAGE_LABELS['idle'],
  overallProgress: 0,
};

export function useAnalysePipeline(): UseAnalysePipeline {
  const bridge = useAIBridge();

  const transport = bridge.getActiveTransport();

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [begruendungById, setBegruendungById] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback((question: string, results: ReadonlyArray<UnifiedSearchResult>, promptOverride: string) => {
    if (running || results.length === 0) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setError(null);
    setResult(null);
    setBegruendungById({}); // leer, aber non-null → Spalte erscheint sofort
    setProgress({ ...INITIAL_PROGRESS, stage: 'begruendung', stageLabel: STAGE_LABELS['begruendung'] });

    void (async () => {
      try {
        // 1. Ist überhaupt eine interne KI verbunden? Der Guard pingt PASSIV
        //    (öffnet keinen Tab) und zeigt sonst den Verbinden-Dialog.
        if (!(await kiVerbindungGeprueft(bridge))) {
          setError('Die interne KI ist nicht verbunden — ohne sie gibt es keine Begründung. Der Verbinden-Dialog ist offen.');
          setRunning(false);
          setProgress(null);
          setBegruendungById(null);
          return;
        }

        // 2. Erreichbarkeit des tatsächlichen Transports. Bei der Bridge hat
        //    Schritt 1 das schon beantwortet; für Direkt-Provider (die der Guard
        //    durchwinkt, weil sie keinen Tab brauchen) ist das die echte Prüfung.
        const reachable = await transport.ping().catch(() => false);
        if (!reachable) {
          setError(`KI-Provider „${transport.displayName ?? transport.name}" nicht erreichbar. Konfiguration in den Einstellungen prüfen.`);
          setRunning(false);
          setProgress(null);
          setBegruendungById(null);
          return;
        }

        const res = await runAnalysisPipeline({
          question,
          results,
          promptOverride,
          transport,
          signal: ctrl.signal,
          onProgress: setProgress,
          onPartial: (map) => setBegruendungById(map),
        });
        setResult(res);
        setBegruendungById(res.begruendungById);
        setRunning(false);
      } catch (err) {
        const e = err as Error;
        if (e.name === 'AbortError' || e.name === 'LLMAbortError') {
          setError(null); // explizit abgebrochen — kein Fehler-Banner
        } else {
          setError(e.message ?? 'KI-Analyse fehlgeschlagen');
        }
        setRunning(false);
      }
    })();
  }, [running, transport, bridge]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
    setProgress(null);
    setResult(null);
    setBegruendungById(null);
    setError(null);
  }, []);

  // Cleanup bei Unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    providerName: transport.displayName ?? transport.name,
    running,
    progress,
    result,
    begruendungById,
    error,
    start,
    cancel,
    reset,
  };
}
