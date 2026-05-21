/**
 * React-Hook der die KI-Analyse-Pipeline kapselt: State + Start/Cancel-API.
 * Pipeline-Code selbst ist React-frei — hier nur das State-Wiring.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import {
  runAnalysisPipeline,
  STAGE_LABELS,
  type PipelineProgress,
  type PipelineResult,
} from './analyse/pipeline';

export interface UseAnalysePipeline {
  available: boolean;
  /** Wird waehrend `ping()` gesetzt; danach `available` reflektiert ping-Ergebnis. */
  checkingAvailability: boolean;
  providerName: string;
  running: boolean;
  progress: PipelineProgress | null;
  result: PipelineResult | null;
  error: string | null;
  start: (question: string) => void;
  cancel: () => void;
  reset: () => void;
}

const INITIAL_PROGRESS: PipelineProgress = {
  stage: 'idle',
  stageLabel: STAGE_LABELS['idle'],
  stageProgress: 0,
  overallProgress: 0,
  stageDurations: {},
};

export function useAnalysePipeline(): UseAnalysePipeline {
  const bridge = useAIBridge();
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const programme = useActiveProgramm(s => s.programme);

  const transport = bridge.getActiveTransport();

  const [available, setAvailable] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Ping einmal beim Mount + wann immer der Provider wechselt.
  useEffect(() => {
    let cancelled = false;
    setCheckingAvailability(true);
    void transport.ping().then(ok => {
      if (cancelled) return;
      setAvailable(ok);
      setCheckingAvailability(false);
    }).catch(() => {
      if (cancelled) return;
      setAvailable(false);
      setCheckingAvailability(false);
    });
    return () => { cancelled = true; };
  }, [transport]);

  const start = useCallback((question: string) => {
    if (!activeProgrammId || running) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setError(null);
    setResult(null);
    setProgress({ ...INITIAL_PROGRESS, stage: 'query-understanding', stageLabel: STAGE_LABELS['query-understanding'] });

    void (async () => {
      try {
        const res = await runAnalysisPipeline({
          question,
          transport,
          idb: storage.idb,
          programmId: activeProgrammId,
          programme,
          signal: ctrl.signal,
          onProgress: (p) => {
            // Wenn die State-Setter im selben Tick mehrfach kommen,
            // koennen sie kollabieren — React batched. Das ist okay.
            setProgress(p);
          },
        });
        setResult(res);
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
  }, [activeProgrammId, running, transport, storage, programme]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
    setProgress(null);
    setResult(null);
    setError(null);
  }, []);

  // Cleanup bei Unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    available,
    checkingAvailability,
    providerName: transport.name,
    running,
    progress,
    result,
    error,
    start,
    cancel,
    reset,
  };
}
