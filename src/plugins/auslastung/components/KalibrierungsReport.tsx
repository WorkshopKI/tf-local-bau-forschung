/**
 * Kalibrierungs-Report Modal/Drawer.
 *
 * Zeigt pro kalibriertem MA:
 *  - Ampel (gruen/gelb/rot) + Spearman + Top-3-Overlap + Accuracy
 *  - Abweichungs-Tabelle (Rank-Differenz > 10)
 *  - Confidence-Grid (Top 10 nach Spearman)
 *  - Slider fuer Scope-Groesse
 *  - "Optimale Werte uebernehmen"-Button
 *
 * Bei mehreren MAs: Tabs pro MA + Aggregations-Tab.
 */
import { useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAuslastungData } from '../hooks/useAuslastungData';
import { useAntraegeCache } from '../hooks/useAntraegeCache';
import { useDialogEsc } from './useDialogEsc';
import {
  bewertungenToVirtuell,
  calibrateSingle,
  explainDeviation,
  gridSearchOptimalConfidence,
  historicalAsVirtuell,
  klassifizierungsAccuracy,
  aggregateGridResults,
  ranks,
  type GridCell,
  type SingleCalibration,
} from '../services/onboarding-kalibrierung';
import { CANONICAL_TIB_KUERZ, CANONICAL_VERBUND_TITEL, type KalibrierungsErgebnis } from '../types';
import type { OnboardingPreview } from '../services/onboarding-import';
import { normalizeKuerzel } from '../services/anonym-map';
import { AnonymIdBadge } from './AnonymIdBadge';
import type { Antrag } from '@/core/services/csv/types';

interface Props {
  open: boolean;
  previews: OnboardingPreview[];
  onClose: () => void;
}

interface PerMaResult {
  preview: OnboardingPreview;
  anonId: string;
  kuerzel: string;
  scope: Antrag[];
  histAntraege: Antrag[];
  single: SingleCalibration;
  grid: GridCell[];
  best: GridCell;
  accuracy: number;
}

export function KalibrierungsReport({ open, previews, onClose }: Props): React.ReactElement | null {
  const storage = useStorage();
  const data = useAuslastungData(s => s.data);
  const upsertErgebnis = useAuslastungData(s => s.upsertKalibrierungsErgebnis);
  const setOptimal = useAuslastungData(s => s.setOptimalConfidence);
  const cache = useAntraegeCache();

  const allUnassigned = useMemo(() => {
    const zugewiesen = new Set(
      data.zuweisungen
        .filter(z => z.status === 'freigegeben' || z.status === 'selbst')
        .map(z => z.antragId),
    );
    return cache.antraege.filter(a => !zugewiesen.has(a.aktenzeichen));
  }, [cache.antraege, data.zuweisungen]);

  const [scopeSize, setScopeSize] = useState<number>(Math.min(80, allUnassigned.length));
  const scope = useMemo(() => allUnassigned.slice(0, scopeSize), [allUnassigned, scopeSize]);

  const [activeTab, setActiveTab] = useState<string>('aggregate');
  const [results, setResults] = useState<PerMaResult[] | null>(null);
  const [running, setRunning] = useState(false);

  // Compute on open / scope change
  useEffect(() => {
    if (!open) return;
    if (previews.length === 0) return;
    void (async () => {
      setRunning(true);
      try {
        const out: PerMaResult[] = [];
        for (const preview of previews) {
          if (!preview.existierterAnonId || !preview.effektivesKuerzel) continue;
          const kuerzel = normalizeKuerzel(preview.effektivesKuerzel);
          if (!kuerzel) continue;
          const histAntraege = cache.antraege.filter(a =>
            normalizeKuerzel((a as Record<string, unknown>)[CANONICAL_TIB_KUERZ]) === kuerzel,
          );
          const histVirtuell = historicalAsVirtuell(cache.antraege, kuerzel);
          const swipe = bewertungenToVirtuell(
            preview.bewertungen,
            data.kalibrierung?.optimaleConfidenceKannIch ?? 0.7,
            data.kalibrierung?.optimaleConfidenceTeilweise ?? 0.3,
          );
          const single = calibrateSingle({
            scope, histVirtuell, swipeVirtuell: swipe,
          });
          const gridResult = gridSearchOptimalConfidence({
            scope,
            histVirtuell,
            bewertungen: preview.bewertungen,
          });
          const accuracy = klassifizierungsAccuracy(histAntraege, data.config.ueberKategorien);
          out.push({
            preview,
            anonId: preview.existierterAnonId,
            kuerzel,
            scope,
            histAntraege,
            single,
            grid: gridResult.grid,
            best: gridResult.best,
            accuracy,
          });
        }
        setResults(out);
        if (out.length > 0) setActiveTab(out.length > 1 ? 'aggregate' : out[0]!.anonId);
      } finally {
        setRunning(false);
      }
    })();
  }, [open, previews, scope, cache.antraege, data.kalibrierung, data.config.ueberKategorien]);

  const aggregate = useMemo(() => {
    if (!results || results.length === 0) return null;
    return aggregateGridResults(results.map(r => r.grid));
  }, [results]);

  async function uebernehmen(kannIch: number, teilweise: number): Promise<void> {
    await setOptimal(storage, kannIch, teilweise);
    // Pro MA ein KalibrierungsErgebnis-Record persistieren
    if (results) {
      for (const r of results) {
        const erg: KalibrierungsErgebnis = {
          anonId: r.anonId,
          spearmanKorrelation: r.single.spearman,
          top3Overlap: r.single.top3Overlap,
          klassifizierungsAccuracy: r.accuracy,
          anzahlAntraege: r.scope.length,
          datum: new Date().toISOString(),
        };
        await upsertErgebnis(storage, erg);
      }
    }
  }

  useDialogEsc(open, running, onClose);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
    >
      <div
        className="w-[960px] max-h-[88vh] rounded-[12px] p-5 flex flex-col gap-3 overflow-hidden"
        style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-medium">Onboarding-Kalibrierung</h3>
          <button type="button" onClick={onClose} disabled={running} className="cursor-pointer text-[var(--tf-text-tertiary)]">×</button>
        </div>

        {/* Scope-Slider */}
        <div className="flex items-center gap-3 text-[12px]">
          <label className="text-[var(--tf-text-tertiary)]">Antrags-Scope:</label>
          <input
            type="range"
            min={10}
            max={Math.max(10, allUnassigned.length)}
            value={scopeSize}
            onChange={e => setScopeSize(Number(e.target.value))}
            className="flex-1"
          />
          <span className="font-mono">{scopeSize} / {allUnassigned.length}</span>
        </div>

        {running && <div className="text-[12px] text-[var(--tf-text-tertiary)]">Berechne Rankings…</div>}

        {results && results.length === 0 && (
          <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">
            Keine kalibrierbaren MAs gefunden (alle Previews sind „neue MAs" ohne historische Anträge).
          </p>
        )}

        {results && results.length > 0 && (
          <>
            {/* Tab-Bar */}
            <div className="flex gap-1 border-b" style={{ borderColor: 'var(--tf-border)' }}>
              {results.length > 1 && (
                <TabButton id="aggregate" active={activeTab === 'aggregate'} onClick={() => setActiveTab('aggregate')}>
                  Aggregat
                </TabButton>
              )}
              {results.map(r => (
                <TabButton key={r.anonId} id={r.anonId} active={activeTab === r.anonId} onClick={() => setActiveTab(r.anonId)}>
                  {r.anonId} ({r.kuerzel})
                </TabButton>
              ))}
            </div>

            <div className="overflow-y-auto flex-1">
              {activeTab === 'aggregate' && aggregate && (
                <AggregateView
                  results={results}
                  aggregate={aggregate}
                  onApply={() => void uebernehmen(aggregate.best.kannIch, aggregate.best.teilweise)}
                />
              )}
              {activeTab !== 'aggregate' && (() => {
                const r = results.find(x => x.anonId === activeTab);
                if (!r) return null;
                return <SingleMaView result={r} scope={scope} onApply={() => void uebernehmen(r.best.kannIch, r.best.teilweise)} />;
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { id: string; active: boolean; onClick: () => void; children: React.ReactNode }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-[12px] cursor-pointer -mb-px ${
        active ? 'font-medium text-[var(--tf-text)]' : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
      }`}
      style={active ? { borderBottom: '2px solid var(--tf-text)' } : undefined}
    >
      {children}
    </button>
  );
}

function Ampel({ spearman, accuracy }: { spearman: number; accuracy: number }): React.ReactElement {
  const color = spearman > 0.7 && accuracy > 0.9 ? 'bg-emerald-500'
    : spearman > 0.4 ? 'bg-amber-500'
    : 'bg-rose-500';
  return <span className={`inline-block w-3 h-3 rounded-full ${color}`} />;
}

function Metric({ label, value, fmt = 'pct' }: { label: string; value: number; fmt?: 'pct' | 'corr' }): React.ReactElement {
  const display = fmt === 'pct' ? `${Math.round(value * 100)}%`
    : value.toFixed(2);
  return (
    <div className="rounded p-2.5" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="text-[18px] font-semibold">{display}</div>
      <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">{label}</div>
    </div>
  );
}

function SingleMaView({ result, scope, onApply }: { result: PerMaResult; scope: Antrag[]; onApply: () => void }): React.ReactElement {
  const { single, grid, best, accuracy, preview } = result;

  // Abweichungs-Tabelle
  const deviations = useMemo(() => {
    const azList = scope.map(a => a.aktenzeichen);
    const aVals = azList.map(az => single.scoresA.get(az) ?? 0);
    const bVals = azList.map(az => single.scoresB.get(az) ?? 0);
    const rA = ranks(aVals);
    const rB = ranks(bVals);
    const out: Array<{ aktenzeichen: string; titel: string; rankA: number; rankB: number; erklaerung: string }> = [];
    for (let i = 0; i < scope.length; i++) {
      const diff = Math.abs(rA[i]! - rB[i]!);
      if (diff <= 10) continue;
      const az = scope[i]!.aktenzeichen;
      const titel = String(scope[i]![CANONICAL_VERBUND_TITEL] ?? '—');
      const bw = preview.bewertungen.find(b => b.aktenzeichen === az);
      const hatHist = single.scoresA.get(az)! > 0;
      const erkl = explainDeviation(rA[i]!, rB[i]!, bw?.bewertung ?? 'nicht_meins', hatHist);
      out.push({ aktenzeichen: az, titel: titel.slice(0, 60), rankA: rA[i]!, rankB: rB[i]!, erklaerung: erkl });
    }
    return out.sort((a, b) => Math.abs(b.rankA - b.rankB) - Math.abs(a.rankA - a.rankB)).slice(0, 20);
  }, [scope, single, preview.bewertungen]);

  // Grid: Top-10 nach Spearman
  const top10 = useMemo(() => {
    return [...grid].sort((a, b) => b.spearman - a.spearman).slice(0, 10);
  }, [grid]);

  return (
    <div className="flex flex-col gap-4 p-1">
      <div className="flex items-center gap-3">
        <Ampel spearman={single.spearman} accuracy={accuracy} />
        <AnonymIdBadge anonId={result.anonId} />
        <span className="text-[12px] text-[var(--tf-text-tertiary)]">{preview.bewertungen.length} Bewertungen · {result.histAntraege.length} hist. Anträge</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Metric label="Top-3-Overlap" value={single.top3Overlap} />
        <Metric label="Spearman" value={single.spearman} fmt="corr" />
        <Metric label="Klassifizierungs-Accuracy" value={accuracy} />
      </div>

      {deviations.length > 0 && (
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1.5">
            Abweichungen ({deviations.length} mit |ΔRang| {'>'} 10)
          </div>
          <div className="rounded overflow-hidden" style={{ border: '0.5px solid var(--tf-border)' }}>
            <table className="w-full text-[11.5px]">
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--tf-border)', background: 'var(--tf-bg-secondary)' }}>
                  <th className="px-2 py-1 text-left">Aktz.</th>
                  <th className="px-2 py-1 text-left">Titel</th>
                  <th className="px-2 py-1 text-right">Rang A</th>
                  <th className="px-2 py-1 text-right">Rang B</th>
                  <th className="px-2 py-1 text-left">Erklärung</th>
                </tr>
              </thead>
              <tbody>
                {deviations.map(d => (
                  <tr key={d.aktenzeichen} style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                    <td className="px-2 py-1 font-mono">{d.aktenzeichen}</td>
                    <td className="px-2 py-1">{d.titel}</td>
                    <td className="px-2 py-1 text-right font-mono">{d.rankA}</td>
                    <td className="px-2 py-1 text-right font-mono">{d.rankB}</td>
                    <td className="px-2 py-1 text-[var(--tf-text-tertiary)]">{d.erklaerung}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1.5">
          Grid-Search: Top-10 Confidence-Paare (Best: {best.kannIch.toFixed(1)}/{best.teilweise.toFixed(1)} → Spearman {best.spearman.toFixed(2)})
        </div>
        <div className="rounded overflow-hidden" style={{ border: '0.5px solid var(--tf-border)' }}>
          <table className="w-full text-[11.5px]">
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--tf-border)', background: 'var(--tf-bg-secondary)' }}>
                <th className="px-2 py-1 text-right">"Kann ich"</th>
                <th className="px-2 py-1 text-right">"Teilweise"</th>
                <th className="px-2 py-1 text-right">Spearman</th>
                <th className="px-2 py-1 text-right">Top-3</th>
              </tr>
            </thead>
            <tbody>
              {top10.map((cell, i) => (
                <tr key={`${cell.kannIch}-${cell.teilweise}`} style={{
                  borderTop: '0.5px solid var(--tf-border)',
                  background: i === 0 ? '#d1fae5' : 'transparent',
                }}>
                  <td className="px-2 py-1 text-right font-mono">{cell.kannIch.toFixed(1)}</td>
                  <td className="px-2 py-1 text-right font-mono">{cell.teilweise.toFixed(1)}</td>
                  <td className="px-2 py-1 text-right font-mono">{cell.spearman.toFixed(2)}</td>
                  <td className="px-2 py-1 text-right font-mono">{Math.round(cell.top3Overlap * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onApply}
          className="px-4 py-1.5 rounded-md text-[12.5px] font-medium cursor-pointer"
          style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
        >
          Optimale Werte übernehmen ({best.kannIch.toFixed(1)} / {best.teilweise.toFixed(1)})
        </button>
      </div>
    </div>
  );
}

function AggregateView({ results, aggregate, onApply }: {
  results: PerMaResult[];
  aggregate: { best: GridCell; mean: number };
  onApply: () => void;
}): React.ReactElement {
  const meanSpearman = results.reduce((s, r) => s + r.single.spearman, 0) / results.length;
  const meanOverlap = results.reduce((s, r) => s + r.single.top3Overlap, 0) / results.length;
  const meanAccuracy = results.reduce((s, r) => s + r.accuracy, 0) / results.length;
  // Ausreisser: > 1 sigma vom Mittel
  const stddev = Math.sqrt(results.reduce((s, r) => s + Math.pow(r.single.spearman - meanSpearman, 2), 0) / results.length);
  const ausreisser = results.filter(r => Math.abs(r.single.spearman - meanSpearman) > stddev);

  return (
    <div className="flex flex-col gap-4 p-1">
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Ø Spearman" value={meanSpearman} fmt="corr" />
        <Metric label="Ø Top-3-Overlap" value={meanOverlap} />
        <Metric label="Ø Accuracy" value={meanAccuracy} />
      </div>

      <div className="rounded p-3 text-[12.5px]" style={{ background: '#d1fae5', color: '#065f46' }}>
        Gesamt-optimale Confidence-Faktoren: <strong>{aggregate.best.kannIch.toFixed(1)}</strong> / <strong>{aggregate.best.teilweise.toFixed(1)}</strong>
        {' '}(Ø Spearman {aggregate.mean.toFixed(2)})
      </div>

      <div>
        <div className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] mb-1.5">
          MA-Ergebnisse
        </div>
        <div className="rounded overflow-hidden" style={{ border: '0.5px solid var(--tf-border)' }}>
          <table className="w-full text-[11.5px]">
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--tf-border)', background: 'var(--tf-bg-secondary)' }}>
                <th className="px-2 py-1 text-left">MA</th>
                <th className="px-2 py-1 text-right">Spearman</th>
                <th className="px-2 py-1 text-right">Top-3</th>
                <th className="px-2 py-1 text-right">Accuracy</th>
                <th className="px-2 py-1 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => {
                const isAusreisser = ausreisser.includes(r);
                return (
                  <tr key={r.anonId} style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                    <td className="px-2 py-1"><AnonymIdBadge anonId={r.anonId} size="sm" /></td>
                    <td className="px-2 py-1 text-right font-mono">{r.single.spearman.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right font-mono">{Math.round(r.single.top3Overlap * 100)}%</td>
                    <td className="px-2 py-1 text-right font-mono">{Math.round(r.accuracy * 100)}%</td>
                    <td className="px-2 py-1">
                      {isAusreisser
                        ? <span className="text-amber-700">⚠ Ausreißer</span>
                        : <span className="text-emerald-700">✓</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onApply}
          className="px-4 py-1.5 rounded-md text-[12.5px] font-medium cursor-pointer"
          style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
        >
          Aggregierte Werte übernehmen ({aggregate.best.kannIch.toFixed(1)} / {aggregate.best.teilweise.toFixed(1)})
        </button>
      </div>
    </div>
  );
}
