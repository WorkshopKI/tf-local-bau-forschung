/**
 * Skill-Eval-GUI (DEV-ONLY) — evaluiert einen Gutachten-Abschnitt (A–G) gegen
 * 1–25 FIKTIVE VB-Fixtures: Generierung prod-treu über den aktiven Bridge-
 * Transport (intern), Bewertung über den externen OpenRouter-Sonnet-Judge.
 *
 * Reine Orchestrierung + Anzeige — die Engine (`runEvalBatch` → `runOneSection`/
 * `runJudge`/`aggregate`) bleibt unverändert (CLI-vergleichbare Zahlen).
 *
 * DSGVO: Fixtures kommen ausschließlich aus dem gebrandeten Bundle
 * (`runEvalBatch` → `loadEvalFixtures`). Diese Komponente importiert KEINE
 * Real-Antrag-Pfade — Abgrenzung zu `SkillTestlaufPanel` (real, ohne Judge).
 *
 * Sichtbarkeit: nur wenn `features.devFixtures` (Mount-Gate in SkillVerwaltungPage);
 * der Judge-Block zusätzlich hinter `isOpenRouterEnabled()`.
 */
import { Fragment, useEffect, useMemo, useState, useRef } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { isOpenRouterEnabled } from '@/config/feature-flags';
import type { SkillRegistryFile } from '@/core/services/skills';
import { STEP_ORDER, type StepId } from '@/plugins/antraege/gutachten/types';
import { stepDef } from '@/plugins/antraege/gutachten/workflow-definition';
import { JUDGE_DIMENSIONS, type JudgeDimension, type JudgeResult } from '@/core/services/skill-eval/types';
import {
  runEvalBatch,
  EVAL_MAX_ANZAHL,
  JUDGE_IDB_KEY,
  JUDGE_DEFAULTS,
  type EvalJudgeConfig,
  type EvalBatchResult,
} from '@/core/services/skill-eval/eval-batch';

const DIM_LABEL: Record<JudgeDimension, string> = {
  fachliche_korrektheit: 'Fachl.',
  vollstaendigkeit: 'Vollst.',
  sprachqualitaet: 'Sprache',
  regeltreue: 'Regeln',
};

/** Mittel der vorhandenen Subscores (wie aggregate.gesamt, aber pro Zeile). */
function rowGesamt(j: JudgeResult): number | null {
  const xs = JUDGE_DIMENSIONS.map(d => j[d]).filter((v): v is number => v !== null);
  if (xs.length === 0) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;
}

function ScoreCell({ value }: { value: number | null }): React.ReactElement {
  if (value === null) return <span className="text-[var(--tf-text-tertiary)]">—</span>;
  const color = value >= 4 ? 'var(--tf-success-text)' : value <= 2 ? 'var(--tf-danger-text)' : 'var(--tf-warning-text)';
  return <span style={{ color }} className="font-mono tabular-nums">{value.toFixed(2)}</span>;
}

interface SkillEvalPanelProps {
  /** Gelesene Skill-Registry (nicht verändert). */
  registry: SkillRegistryFile;
}

export function SkillEvalPanel({ registry }: SkillEvalPanelProps): React.ReactElement {
  const storage = useStorage();
  const bridge = useAIBridge();
  const judgeAvailable = isOpenRouterEnabled();

  const [abschnitt, setAbschnitt] = useState<StepId>('A');
  const [anzahl, setAnzahl] = useState(3);
  const [judge, setJudge] = useState<EvalJudgeConfig>(JUDGE_DEFAULTS);
  const [judgeOpen, setJudgeOpen] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [batch, setBatch] = useState<EvalBatchResult | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  // Dev-eval-eigene Judge-Config laden (eigener IDB-Key, NICHT `ai-provider`).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await storage.idb.get<EvalJudgeConfig>(JUDGE_IDB_KEY);
      if (!cancelled && saved) setJudge({ ...JUDGE_DEFAULTS, ...saved });
    })();
    return () => { cancelled = true; };
  }, [storage.idb]);

  const sections = useMemo(() => STEP_ORDER.map(id => ({ id, label: stepDef(id).label })), []);

  const rows = useMemo(() => {
    if (!batch) return [];
    const judgeByVb = new Map(batch.judges.map(j => [j.vbFile, j]));
    return batch.results.map(r => ({ res: r, judge: judgeByVb.get(r.vbFile) ?? null }));
  }, [batch]);

  const mittel = batch?.matrix.cells[0]?.judge ?? null;

  const start = useAsyncAction(async () => {
    setBatch(null);
    setExpanded(new Set());
    setProgress({ done: 0, total: anzahl });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // Judge-Config best-effort persistieren (dev-eval-eigener Key).
      await storage.idb.set(JUDGE_IDB_KEY, judge);
      const res = await runEvalBatch({
        abschnitt,
        anzahl,
        registry,
        genTransport: bridge.getActiveTransport(),
        judge: judgeAvailable ? judge : null,
        signal: controller.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setBatch(res);
    } finally {
      abortRef.current = null;
    }
  });

  const toggleRow = (vbFile: string): void => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(vbFile)) next.delete(vbFile); else next.add(vbFile);
      return next;
    });
  };

  const judgeEffektivAus = !judgeAvailable || judge.apiKey.trim() === '';

  return (
    <div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] flex flex-col">
      {/* Kopf */}
      <div className="px-5 py-4 border-b-[0.5px] border-[var(--tf-border)]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-medium text-[var(--tf-text)]">Skill-Eval (fiktive Fixtures)</span>
          <span className="text-[10.5px] px-2 py-0.5 rounded-[99px] bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]">dev-only</span>
        </div>
        <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-0.5">
          Generierung über die interne KI; Bewertung über den externen Judge — ausschließlich gegen
          gebündelte, fiktive VBs (keine realen Anträge).
        </div>
      </div>

      {/* Steuerung */}
      <div className="px-5 py-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">Abschnitt</span>
            <select
              value={abschnitt}
              onChange={e => setAbschnitt(e.target.value)}
              className="text-[13px] px-2.5 py-2 rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-transparent outline-none focus:border-[var(--tf-primary)] min-w-[260px]"
            >
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.id} — {s.label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">Anzahl VBs: <b className="text-[var(--tf-text)]">{anzahl}</b></span>
            <input
              type="range"
              min={1}
              max={EVAL_MAX_ANZAHL}
              value={anzahl}
              onChange={e => setAnzahl(Number(e.target.value))}
              disabled={start.busy}
              className="w-full accent-[var(--tf-primary)]"
            />
          </label>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              onClick={() => start.run()}
              loading={start.busy}
            >
              {start.busy ? `Läuft… ${progress ? `${progress.done}/${progress.total}` : ''}` : 'Testlauf starten'}
            </Button>
            {start.busy && (
              <Button
                variant="secondary"
                onClick={() => abortRef.current?.abort()}
              >
                Abbrechen
              </Button>
            )}
          </div>
        </div>

        {/* Judge-Konfiguration (nur bei OpenRouter) */}
        {judgeAvailable ? (
          <div className="rounded-[8px] border-[0.5px] border-[var(--tf-border)]">
            <button
              onClick={() => setJudgeOpen(o => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]"
            >
              {judgeOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              Judge-Konfiguration (OpenRouter)
              {judgeEffektivAus && <span className="text-[10.5px] px-2 py-0.5 rounded-[99px] bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]">kein Key → Judge aus</span>}
            </button>
            {judgeOpen && (
              <div className="px-3 pb-3 flex flex-col gap-2.5">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-[var(--tf-text-tertiary)]">Endpoint</span>
                  <input
                    value={judge.endpoint}
                    onChange={e => setJudge(j => ({ ...j, endpoint: e.target.value }))}
                    className="text-[12.5px] px-2.5 py-1.5 rounded-[7px] border-[0.5px] border-[var(--tf-border)] bg-transparent outline-none focus:border-[var(--tf-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-[var(--tf-text-tertiary)]">Modell</span>
                  <input
                    value={judge.model}
                    onChange={e => setJudge(j => ({ ...j, model: e.target.value }))}
                    className="text-[12.5px] px-2.5 py-1.5 rounded-[7px] border-[0.5px] border-[var(--tf-border)] bg-transparent outline-none focus:border-[var(--tf-primary)]"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-[var(--tf-text-tertiary)]">API-Key (OpenRouter)</span>
                  <input
                    type="password"
                    value={judge.apiKey}
                    onChange={e => setJudge(j => ({ ...j, apiKey: e.target.value }))}
                    placeholder="sk-or-…"
                    autoComplete="off"
                    className="text-[12.5px] px-2.5 py-1.5 rounded-[7px] border-[0.5px] border-[var(--tf-border)] bg-transparent outline-none focus:border-[var(--tf-primary)] font-mono"
                  />
                </label>
                <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">Wird beim Start gespeichert (dev-eval-eigener Schlüssel, getrennt vom KI-Assistent-Provider).</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-[11.5px] text-[var(--tf-text-tertiary)] rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-3 py-2">
            OpenRouter ist in dieser Build-Variante deaktiviert — nur Generierung + deterministische Checks, kein Judge.
          </div>
        )}

        {start.error && (
          <div className="rounded p-2.5 text-[12px]" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {start.error}</div>
        )}
      </div>

      {/* Ergebnis-Tabelle */}
      {batch && (
        <div className="px-5 pb-5">
          {!batch.judgeAktiv && (
            <div className="mb-3 text-[11.5px] text-[var(--tf-text-tertiary)]">
              Judge war aus — nur Generierung + Checks. Sub-Scores leer.
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr className="text-[var(--tf-text-tertiary)] text-left">
                  <th className="py-1.5 pr-2 font-medium w-5"></th>
                  <th className="py-1.5 pr-3 font-medium">VB</th>
                  {JUDGE_DIMENSIONS.map(d => (
                    <th key={d} className="py-1.5 px-2 font-medium text-right whitespace-nowrap">{DIM_LABEL[d]}</th>
                  ))}
                  <th className="py-1.5 px-2 font-medium text-right">Gesamt</th>
                  <th className="py-1.5 px-2 font-medium text-right">Zeichen</th>
                  <th className="py-1.5 pl-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ res, judge: jr }) => {
                  const isOpen = expanded.has(res.vbFile);
                  const zeichen = res.parsed?.finalerText.length ?? 0;
                  const hasDetail = !!(jr?.begruendung || jr?.prompt_verbesserung);
                  return (
                    <Fragment key={res.vbFile}>
                      <tr
                        onClick={() => hasDetail && toggleRow(res.vbFile)}
                        className={`border-t-[0.5px] border-[var(--tf-border)] ${hasDetail ? 'cursor-pointer hover:bg-[var(--tf-hover)]' : ''}`}
                      >
                        <td className="py-2 pr-2 text-[var(--tf-text-tertiary)]">
                          {hasDetail && (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
                        </td>
                        <td className="py-2 pr-3 text-[var(--tf-text)] max-w-[280px] truncate" title={res.vbFile}>{res.vbFile}</td>
                        {JUDGE_DIMENSIONS.map(d => (
                          <td key={d} className="py-2 px-2 text-right"><ScoreCell value={jr ? jr[d] : null} /></td>
                        ))}
                        <td className="py-2 px-2 text-right"><ScoreCell value={jr ? rowGesamt(jr) : null} /></td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-[var(--tf-text-secondary)]">{zeichen.toLocaleString('de-DE')}</td>
                        <td className="py-2 pl-2">
                          {res.fehler
                            ? <span className="text-[10.5px] px-2 py-0.5 rounded-[99px] bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]">Fehler</span>
                            : !res.parsed
                              ? <span className="text-[10.5px] px-2 py-0.5 rounded-[99px] bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]">kein Text</span>
                              : <span className="text-[10.5px] px-2 py-0.5 rounded-[99px] bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]">ok</span>}
                        </td>
                      </tr>
                      {isOpen && hasDetail && (
                        <tr className="bg-[var(--tf-bg-secondary)]">
                          <td></td>
                          <td colSpan={JUDGE_DIMENSIONS.length + 4} className="py-2.5 pr-3 text-[12px] text-[var(--tf-text-secondary)]">
                            {jr?.begruendung && <p className="m-0 mb-2"><b className="text-[var(--tf-text)]">Begründung:</b> {jr.begruendung}</p>}
                            {jr?.prompt_verbesserung && <p className="m-0"><b className="text-[var(--tf-text)]">Prompt-Verbesserung:</b> {jr.prompt_verbesserung}</p>}
                          </td>
                        </tr>
                      )}
                      {res.fehler && (
                        <tr>
                          <td></td>
                          <td colSpan={JUDGE_DIMENSIONS.length + 4} className="pb-2 text-[11px] text-[var(--tf-danger-text)]">{res.fehler}</td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              {mittel && (
                <tfoot>
                  <tr className="border-t-[0.5px] border-[var(--tf-border)] font-medium text-[var(--tf-text)]">
                    <td></td>
                    <td className="py-2 pr-3">Mittel ({batch.judges.length})</td>
                    {JUDGE_DIMENSIONS.map(d => (
                      <td key={d} className="py-2 px-2 text-right"><ScoreCell value={mittel[d]} /></td>
                    ))}
                    <td className="py-2 px-2 text-right"><ScoreCell value={mittel.gesamt} /></td>
                    <td></td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <div className="text-[10.5px] text-[var(--tf-text-tertiary)] mt-2">
            Modell: {batch.modellId} · {batch.results.length} Läufe · {batch.judges.length} Judge-Bewertungen
          </div>
        </div>
      )}
    </div>
  );
}
