/**
 * Skill-Eval-GUI (DEV-ONLY) — evaluiert einen Gutachten-Abschnitt (A–G) gegen
 * 1–25 FIKTIVE VB-Fixtures. Generierung prod-treu über den aktiven Bridge-
 * Transport (intern, gpt-oss). Kontext-Achse `voll · relevant · beide` (A/B der
 * Relevanz-Map). Bewertung optional über den Judge — intern mit Qwen3.6-35B als
 * Default, OpenRouter (extern) nur gespiegelt hinter `isOpenRouterEnabled()`.
 *
 * Reine Orchestrierung + Anzeige — die Engine (`runEvalBatch` → `runOneSection`/
 * `runJudge`/`aggregate` + die Relevanz-Map-Helfer) bleibt unverändert
 * (CLI-vergleichbare Zahlen). Der interne Judge-Adapter hält `runJudge` ebenfalls
 * unangetastet (frischer Chat + `ziel:'agentisch'` + Thinking-Strip je Submit).
 *
 * DSGVO: Fixtures kommen ausschließlich aus dem gebrandeten Bundle
 * (`runEvalBatch` → `loadEvalFixtures`); der OpenRouter-Judge asserted die
 * Provenienz zusätzlich auf dem ORIGINAL-Array vor dem Transport-Bau. Diese
 * Komponente importiert KEINE Real-Antrag-Pfade — Abgrenzung zu `SkillTestlaufPanel`.
 *
 * Sichtbarkeit: nur wenn `features.devFixtures` (Mount-Gate in SkillVerwaltungPage);
 * die OpenRouter-Judge-Option zusätzlich hinter `isOpenRouterEnabled()`.
 */
import { modellLabel } from '@/core/services/ai/bridge-modelle';
import { Fragment, useEffect, useMemo, useState, useRef } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { kiVerbindungGeprueft } from '@/core/services/ai/ki-guard';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { isOpenRouterEnabled } from '@/config/feature-flags';
import { DirectLLMTransport } from '@/core/services/ai/transports/direct-llm';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { SkillRegistryFile } from '@/core/services/skills';
import { STEP_ORDER, type StepId } from '@/plugins/antraege/gutachten/types';
import { stepDef } from '@/plugins/antraege/gutachten/workflow-definition';
import { RELEVANZ_MAP_MIN_CHARS } from '@/plugins/antraege/gutachten/relevanz-map';
import { JUDGE_DIMENSIONS, type EvalKontext, type JudgeDimension, type JudgeResult } from '@/core/services/skill-eval/types';
import { cellAt } from '@/core/services/skill-eval/aggregate';
import { loadEvalFixtures, isFromEvalBundle } from '@/core/services/skill-eval/fixtures/bundle';
import {
  runEvalBatch,
  makeStarkerJudgeTransport,
  EVAL_MAX_ANZAHL,
  JUDGE_IDB_KEY,
  JUDGE_DEFAULTS,
  type EvalBatchKontext,
  type EvalJudgeConfig,
  type EvalBatchResult,
} from '@/core/services/skill-eval/eval-batch';

const DIM_LABEL: Record<JudgeDimension, string> = {
  fachliche_korrektheit: 'Fachl.',
  vollstaendigkeit: 'Vollst.',
  sprachqualitaet: 'Sprache',
  regeltreue: 'Regeln',
};

const KONTEXT_LABEL: Record<EvalKontext, string> = { voll: 'voll', relevant: 'relevant' };
type JudgeModus = 'intern-agentisch' | 'openrouter';

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
  const openRouterVerfuegbar = isOpenRouterEnabled();

  const [abschnitt, setAbschnitt] = useState<StepId>('A');
  const [anzahl, setAnzahl] = useState(3);
  const [kontext, setKontext] = useState<EvalBatchKontext>('voll');
  const [mapSchwelle, setMapSchwelle] = useState(RELEVANZ_MAP_MIN_CHARS);
  const [mitJudge, setMitJudge] = useState(false);
  const [judgeModus, setJudgeModus] = useState<JudgeModus>('intern-agentisch');
  const [judge, setJudge] = useState<EvalJudgeConfig>(JUDGE_DEFAULTS);
  const [judgeOpen, setJudgeOpen] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [batch, setBatch] = useState<EvalBatchResult | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  // Dev-eval-eigene OpenRouter-Judge-Config laden (eigener IDB-Key, NICHT `ai-provider`).
  useEffect(() => {
    if (!openRouterVerfuegbar) return;
    let cancelled = false;
    void (async () => {
      const saved = await storage.idb.get<EvalJudgeConfig>(JUDGE_IDB_KEY);
      if (!cancelled && saved) setJudge({ ...JUDGE_DEFAULTS, ...saved });
    })();
    return () => { cancelled = true; };
  }, [storage.idb, openRouterVerfuegbar]);

  const sections = useMemo(() => STEP_ORDER.map(id => ({ id, label: stepDef(id).label })), []);

  const rowKey = (vbFile: string, k: EvalKontext | undefined): string => `${vbFile}::${k ?? 'voll'}`;

  const rows = useMemo(() => {
    if (!batch) return [];
    const judgeByKey = new Map(batch.judges.map(j => [rowKey(j.vbFile, j.kontext), j]));
    return batch.results.map(r => ({ res: r, judge: judgeByKey.get(rowKey(r.vbFile, r.kontext)) ?? null }));
  }, [batch]);

  // Map-Transparenz (nur relevant/beide-Läufe befüllen relevanzInfos).
  const relInfos = batch?.relevanzInfos ?? [];
  const mapAngewandt = relInfos.filter(r => r.mapAngewandt).length;

  // Mittel je Kontext (ersetzt das alte cells[0]) + Δ (relevant − voll) auf Gesamt.
  const batchAbschnitt = batch?.matrix.abschnitte[0];
  const mittelZeilen = useMemo(() => {
    if (!batch || !batchAbschnitt) return [];
    return batch.matrix.kontexte.map(k => ({ kontext: k, cell: cellAt(batch.matrix, batchAbschnitt, batch.modellId, k) ?? null }));
  }, [batch, batchAbschnitt]);
  const gesamtVoll = mittelZeilen.find(m => m.kontext === 'voll')?.cell?.judge.gesamt ?? null;
  const gesamtRelevant = mittelZeilen.find(m => m.kontext === 'relevant')?.cell?.judge.gesamt ?? null;
  const deltaGesamt = gesamtVoll !== null && gesamtRelevant !== null ? Math.round((gesamtRelevant - gesamtVoll) * 100) / 100 : null;
  const zeigeKontext = (batch?.matrix.kontexte.length ?? 0) > 1;

  const start = useAsyncAction(async () => {
    // Verbindung zuerst: `runEvalBatch` prüft die Erreichbarkeit passiv (kein
    // Tab). Der Weg zum Verbinden gehört hierher, wo der Klick passiert.
    if (!(await kiVerbindungGeprueft(bridge))) return;
    setBatch(null);
    setExpanded(new Set());
    const kontexteN = kontext === 'both' ? 2 : 1;
    setProgress({ done: 0, total: anzahl * kontexteN });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // Judge-Transport bauen (injiziert — hält runEvalBatch bridge-frei).
      let judgeTransport: AITransport | null = null;
      let judgeModellId: string | null = null;
      if (mitJudge) {
        if (judgeModus === 'openrouter') {
          // Externer Pfad NUR für gebrandete (= fiktive) Fixtures: Assert auf dem
          // ORIGINAL-Array (slice/map verlieren das Brand-Symbol) VOR dem Transport-Bau.
          const original = loadEvalFixtures();
          if (!isFromEvalBundle(original)) {
            throw new Error('Provenienz-Guard: Fixtures stammen nicht aus dem Eval-Bundle.');
          }
          if (!openRouterVerfuegbar) {
            throw new Error('OpenRouter ist in dieser Build-Variante deaktiviert.');
          }
          await storage.idb.set(JUDGE_IDB_KEY, judge);
          judgeTransport = new DirectLLMTransport(judge.endpoint, judge.model, judge.apiKey);
          judgeModellId = judge.model;
        } else {
          // Intern-agentisch: DSGVO-Gate wirft bei externem Provider → Banner, kein Lauf.
          judgeTransport = makeStarkerJudgeTransport(bridge.getTransportForAssistent());
          judgeModellId = modellLabel('stark');
        }
      }
      const res = await runEvalBatch({
        abschnitt,
        anzahl,
        registry,
        // Die Eval-GUI faehrt ausschliesslich FIKTIVE Fixtures aus dem
        // gebuendelten Asset — echter Antragsinhalt ist hier konstruktiv aus.
        genTransport: bridge.getActiveTransport(), // allow-raw-active-transport: nur fiktive Fixtures (Guard eval-gui-fictional-only)
        kontext,
        mapSchwelle,
        judgeTransport,
        judgeModellId,
        signal: controller.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setBatch(res);
    } finally {
      abortRef.current = null;
    }
  });

  const herunterladen = (): void => {
    if (!batch) return;
    const resultLines = batch.results.map(r => JSON.stringify(r));
    const judgeLines = batch.judges.map(j => JSON.stringify({ ...j, judgeModellId: batch.judgeModellId }));
    const ndjson = [...resultLines, ...judgeLines].join('\n');
    const blob = new Blob([ndjson], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skill-eval-${batch.matrix.abschnitte[0] ?? abschnitt}-${kontext}.jsonl`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const toggleRow = (key: string): void => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const judgeSpaltenSpan = JUDGE_DIMENSIONS.length + (zeigeKontext ? 5 : 4);

  return (
    <div className="rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] flex flex-col">
      {/* Kopf */}
      <div className="px-5 py-4 border-b-[0.5px] border-[var(--tf-border)]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-medium text-[var(--tf-text)]">Skill-Eval (fiktive Fixtures)</span>
          <span className="text-[10.5px] px-2 py-0.5 rounded-[99px] bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]">dev-only</span>
        </div>
        <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-0.5">
          Generierung über die interne KI (gpt-oss); Kontext-Achse voll/relevant für das Relevanz-Map-A/B;
          Bewertung optional (intern-agentisch, Qwen) — ausschließlich gegen gebündelte, fiktive VBs.
        </div>
      </div>

      {/* Steuerung */}
      <div className="px-5 py-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">Abschnitt</span>
            <select
              value={abschnitt}
              onChange={e => setAbschnitt(e.target.value as StepId)}
              className="text-[13px] px-2.5 py-2 rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-transparent outline-none focus:border-[var(--tf-primary)] min-w-[240px]"
            >
              {sections.map(s => (
                <option key={s.id} value={s.id}>{s.id} — {s.label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">Kontext (A/B)</span>
            <select
              value={kontext}
              onChange={e => setKontext(e.target.value as EvalBatchKontext)}
              disabled={start.busy}
              className="text-[13px] px-2.5 py-2 rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-transparent outline-none focus:border-[var(--tf-primary)] min-w-[130px]"
            >
              <option value="voll">voll</option>
              <option value="relevant">relevant</option>
              <option value="both">beide</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
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

        {/* Map-Schwellen-Override (nur relevant/beide) — reine Eval-Option, nie Produktion. */}
        {kontext !== 'voll' && (
          <label className="flex flex-col gap-1 max-w-[420px]">
            <span className="text-[11px] text-[var(--tf-text-tertiary)]">
              Map-Schwelle (Zeichen) — <b className="text-[var(--tf-warning-text)]">nur Eval</b>: unter dieser Größe läuft die VB als Volltext (kein A/B).
            </span>
            <input
              type="number"
              min={0}
              step={1000}
              value={mapSchwelle}
              onChange={e => setMapSchwelle(Math.max(0, Number(e.target.value) || 0))}
              disabled={start.busy}
              className="text-[13px] px-2.5 py-2 rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-transparent outline-none focus:border-[var(--tf-primary)] font-mono w-[180px]"
            />
          </label>
        )}

        {/* Judge-Bedienung */}
        <div className="rounded-[8px] border-[0.5px] border-[var(--tf-border)] px-3 py-2.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch checked={mitJudge} onCheckedChange={setMitJudge} disabled={start.busy} />
              <span className="text-[12.5px] text-[var(--tf-text)]">Judge einschließen</span>
              <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">verdoppelt die Bridge-Laufzeit · Default aus</span>
            </div>
            {mitJudge && (
              <label className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--tf-text-tertiary)]">Judge-Modell</span>
                <select
                  value={judgeModus}
                  onChange={e => setJudgeModus(e.target.value as JudgeModus)}
                  disabled={start.busy}
                  className="text-[12.5px] px-2 py-1.5 rounded-[7px] border-[0.5px] border-[var(--tf-border)] bg-transparent outline-none focus:border-[var(--tf-primary)]"
                >
                  <option value="intern-agentisch">intern ({modellLabel('stark')})</option>
                  {openRouterVerfuegbar && <option value="openrouter">OpenRouter (extern)</option>}
                </select>
              </label>
            )}
          </div>

          {/* OpenRouter-Config nur bei Modus openrouter. */}
          {mitJudge && judgeModus === 'openrouter' && openRouterVerfuegbar && (
            <div className="rounded-[8px] border-[0.5px] border-[var(--tf-border)]">
              <button
                onClick={() => setJudgeOpen(o => !o)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]"
              >
                {judgeOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                Judge-Konfiguration (OpenRouter)
                {judge.apiKey.trim() === '' && <span className="text-[10.5px] px-2 py-0.5 rounded-[99px] bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]">kein Key</span>}
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
          )}
        </div>

        {start.error && (
          <div className="rounded p-2.5 text-[12px]" style={{ background: 'var(--tf-danger-bg)', color: 'var(--tf-danger-text)' }}>⚠ {start.error}</div>
        )}
      </div>

      {/* Ergebnis */}
      {batch && (
        <div className="px-5 pb-5">
          {/* Map-Transparenz (Ehrlichkeits-Pflicht). */}
          {relInfos.length > 0 && (
            <div className="mb-3 text-[11.5px]">
              <div className="text-[var(--tf-text-secondary)]">
                Map angewandt: <b className="text-[var(--tf-text)]">{mapAngewandt}/{relInfos.length}</b> Fixtures
                {deltaGesamt !== null && (
                  <>
                    {' · '}Δ Gesamt (relevant − voll):{' '}
                    <b style={{ color: deltaGesamt >= 0 ? 'var(--tf-success-text)' : 'var(--tf-danger-text)' }}>
                      {deltaGesamt >= 0 ? '+' : ''}{deltaGesamt.toFixed(2)}
                    </b>
                  </>
                )}
              </div>
              {mapAngewandt === 0 && (
                <div className="mt-1 px-2.5 py-1.5 rounded-[6px] bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]">
                  ⚠ Kein Fixture lief durch die Map (alle unter Schwelle / leer) — beide Arme identisch, kein echtes A/B. Schwelle senken oder größere Fixtures.
                </div>
              )}
              <div className="mt-1 flex flex-col gap-0.5 text-[10.5px] text-[var(--tf-text-tertiary)] font-mono">
                {relInfos.map(r => (
                  <div key={r.vbFile} className="truncate" title={`${r.vbFile} · ${r.grund}`}>
                    {r.mapAngewandt ? '●' : '○'} {r.vbFile}: {r.vollChars.toLocaleString('de-DE')} → {r.relevantChars.toLocaleString('de-DE')} Zeichen ({r.grund})
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mb-2">
            {!batch.judgeAktiv ? (
              <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">Judge war aus — nur Generierung + Checks. Sub-Scores leer.</div>
            ) : <span />}
            <Button variant="secondary" onClick={herunterladen}>
              <Download size={13} className="mr-1" /> JSONL
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr className="text-[var(--tf-text-tertiary)] text-left">
                  <th className="py-1.5 pr-2 font-medium w-5"></th>
                  <th className="py-1.5 pr-3 font-medium">VB</th>
                  {zeigeKontext && <th className="py-1.5 px-2 font-medium">Kontext</th>}
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
                  const key = rowKey(res.vbFile, res.kontext);
                  const isOpen = expanded.has(key);
                  const zeichen = res.parsed?.finalerText.length ?? 0;
                  const hasDetail = !!(jr?.begruendung || jr?.prompt_verbesserung);
                  return (
                    <Fragment key={key}>
                      <tr
                        onClick={() => hasDetail && toggleRow(key)}
                        className={`border-t-[0.5px] border-[var(--tf-border)] ${hasDetail ? 'cursor-pointer hover:bg-[var(--tf-hover)]' : ''}`}
                      >
                        <td className="py-2 pr-2 text-[var(--tf-text-tertiary)]">
                          {hasDetail && (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
                        </td>
                        <td className="py-2 pr-3 text-[var(--tf-text)] max-w-[240px] truncate" title={res.vbFile}>{res.vbFile}</td>
                        {zeigeKontext && (
                          <td className="py-2 px-2">
                            <span className="text-[10.5px] px-2 py-0.5 rounded-[99px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">{KONTEXT_LABEL[res.kontext ?? 'voll']}</span>
                          </td>
                        )}
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
                          <td colSpan={judgeSpaltenSpan} className="py-2.5 pr-3 text-[12px] text-[var(--tf-text-secondary)]">
                            {jr?.begruendung && <p className="m-0 mb-2"><b className="text-[var(--tf-text)]">Begründung:</b> {jr.begruendung}</p>}
                            {jr?.prompt_verbesserung && <p className="m-0"><b className="text-[var(--tf-text)]">Prompt-Verbesserung:</b> {jr.prompt_verbesserung}</p>}
                          </td>
                        </tr>
                      )}
                      {res.fehler && (
                        <tr>
                          <td></td>
                          <td colSpan={judgeSpaltenSpan} className="pb-2 text-[11px] text-[var(--tf-danger-text)]">{res.fehler}</td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              {mittelZeilen.some(m => m.cell?.judge.gesamt !== null && m.cell?.judge.gesamt !== undefined) && (
                <tfoot>
                  {mittelZeilen.map(({ kontext: k, cell }) => (
                    <tr key={k} className="border-t-[0.5px] border-[var(--tf-border)] font-medium text-[var(--tf-text)]">
                      <td></td>
                      <td className="py-2 pr-3">Mittel ({cell?.judgeN ?? 0})</td>
                      {zeigeKontext && (
                        <td className="py-2 px-2">
                          <span className="text-[10.5px] px-2 py-0.5 rounded-[99px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">{KONTEXT_LABEL[k]}</span>
                        </td>
                      )}
                      {JUDGE_DIMENSIONS.map(d => (
                        <td key={d} className="py-2 px-2 text-right"><ScoreCell value={cell?.judge[d] ?? null} /></td>
                      ))}
                      <td className="py-2 px-2 text-right"><ScoreCell value={cell?.judge.gesamt ?? null} /></td>
                      <td></td>
                      <td></td>
                    </tr>
                  ))}
                </tfoot>
              )}
            </table>
          </div>
          <div className="text-[10.5px] text-[var(--tf-text-tertiary)] mt-2">
            Modell: {batch.modellId} · {batch.results.length} Läufe · {batch.judges.length} Judge-Bewertungen
            {batch.judgeModellId && <> · Judge: {batch.judgeModellId}</>}
          </div>
        </div>
      )}
    </div>
  );
}
