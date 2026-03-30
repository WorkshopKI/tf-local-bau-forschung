import { useState } from 'react';
import { Download, ChevronDown, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { Button, CollapsibleSection, ProgressBar, Tooltip } from '@/ui';
import type { EvalReport, TestCaseResult } from '@/core/services/search/eval/eval-types';
import { evalToMarkdown, evalToJSON, downloadAsFile } from '@/core/services/search/eval/eval-export';

interface EvalResultViewProps {
  report: EvalReport;
  previousReport?: EvalReport;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Einfach (exakte Fachbegriffe)',
  medium: 'Mittel (verwandte Begriffe)',
  hard: 'Schwierig (Umgangssprache)',
};

export function EvalResultView({ report, previousReport }: EvalResultViewProps): React.ReactElement {
  const s = report.summary;
  const prev = previousReport?.summary;
  const passRate = Math.round((s.passed / s.total) * 100);
  const top1Pct = Math.round(s.top1Accuracy * 100);

  return (
    <div className="space-y-4">
      {/* Metric Cards: Trefferquote + Genauigkeit */}
      <div className="grid grid-cols-1 min-[500px]:grid-cols-2 gap-3">
        <MetricCard label="Trefferquote" value={`${passRate}%`}
          hint="Richtiges Dokument in Top 5 gefunden"
          hintTooltip="Anteil der Testfaelle bei denen mindestens eines der erwarteten Dokumente unter den ersten 5 Suchergebnissen erscheint. Basiert auf 20 Testabfragen mit vordefinierten erwarteten Ergebnissen."
          delta={prev ? Math.round((s.passed / s.total - prev.passed / prev.total) * 100) : undefined} />
        <MetricCard label="Genauigkeit" value={`${top1Pct}%`}
          hint="Richtiges Dokument an erster Stelle"
          hintTooltip="Anteil der Testfaelle bei denen das erwartete Dokument das allererste Suchergebnis ist. Dies ist die strengste Metrik — nicht 'irgendwo in der Liste', sondern 'ganz oben'."
          delta={prev ? Math.round((s.top1Accuracy - prev.top1Accuracy) * 100) : undefined} />
      </div>

      {/* Kategorie-Balken */}
      <div className="space-y-2">
        {s.byCategory['keyword'] && (
          <LabeledBar passed={s.byCategory['keyword'].passed} total={s.byCategory['keyword'].total}
            label={<Tooltip text="Testfaelle bei denen der Nutzer den genauen Fachbegriff eingibt, z.B. 'Brandschutz' oder 'Tiefgarage'. Hier zaehlt die Keyword-Suche."><span className="cursor-help" style={{ borderBottom: '1px dotted var(--tf-text-tertiary)' }}>Exakte Suche</span></Tooltip>} />
        )}
        {s.byCategory['semantic'] && (
          <LabeledBar passed={s.byCategory['semantic'].passed} total={s.byCategory['semantic'].total}
            label={<Tooltip text="Testfaelle bei denen der Nutzer mit eigenen Worten sucht, z.B. 'Gift im Boden' statt 'Altlastengutachten'. Hier zaehlt die KI-gestuetzte Vektorsuche."><span className="cursor-help" style={{ borderBottom: '1px dotted var(--tf-text-tertiary)' }}>Bedeutungssuche</span></Tooltip>} />
        )}
      </div>

      {/* Fachdetail mit Tooltips */}
      <p className="text-[11px] text-[var(--tf-text-tertiary)]">
        Fachdetail:{' '}
        <Tooltip text="Precision bei 3 Ergebnissen — Wie viele der erwarteten Dokumente erscheinen unter den ersten 3 Suchergebnissen? Hoeher = der Nutzer findet das Richtige schneller.">
          <span className="cursor-help" style={{ borderBottom: '1px dotted var(--tf-text-tertiary)' }}>
            P@3 {Math.round(s.avgPrecision3 * 100)}%
          </span>
        </Tooltip>
        {' \u00b7 '}
        <Tooltip text="Precision bei 5 Ergebnissen — Wie viele der erwarteten Dokumente erscheinen unter den ersten 5? Sollte hoeher sein als P@3.">
          <span className="cursor-help" style={{ borderBottom: '1px dotted var(--tf-text-tertiary)' }}>
            P@5 {Math.round(s.avgPrecision5 * 100)}%
          </span>
        </Tooltip>
        {' \u00b7 '}
        <Tooltip text="Treffergenauigkeit — Bei wie vielen Suchanfragen steht das beste Ergebnis ganz oben? 100% = perfekte Sortierung.">
          <span className="cursor-help" style={{ borderBottom: '1px dotted var(--tf-text-tertiary)' }}>
            Top-1 Accuracy {top1Pct}%
          </span>
        </Tooltip>
      </p>

      {/* Einzelergebnisse */}
      <CollapsibleSection label="Einzelergebnisse" defaultOpen={false}
        subtitle={`${s.passed} bestanden, ${s.failed} offen`}>
        <ResultTable results={report.results} />
      </CollapsibleSection>

      {/* Nach Schwierigkeit */}
      <CollapsibleSection label="Nach Schwierigkeit" defaultOpen={false}>
        <div className="space-y-2">
          {(['easy', 'medium', 'hard'] as const).map(diff => {
            const data = s.byDifficulty[diff];
            if (!data) return null;
            return (
              <LabeledBar key={diff} label={DIFFICULTY_LABELS[diff] ?? diff}
                passed={data.passed} total={data.total} />
            );
          })}
        </div>
      </CollapsibleSection>

      {/* Export + Verlauf (Section 5) */}
      <CollapsibleSection label="Export & Verlauf" defaultOpen={false}
        subtitle={`Evaluierung vom ${new Date(report.timestamp).toLocaleDateString('de-DE')}`}>
        <div className="space-y-3">
          <div className="flex gap-3">
            <Button variant="secondary" icon={Download}
              onClick={() => downloadAsFile(evalToMarkdown(report), 'EVAL_REPORT.md', 'text/markdown')}>
              Markdown
            </Button>
            <Button variant="secondary" icon={Download}
              onClick={() => downloadAsFile(evalToJSON(report), 'eval_report.json', 'application/json')}>
              JSON
            </Button>
          </div>
          {previousReport && (
            <div className="text-[12px] text-[var(--tf-text-secondary)] space-y-1">
              <p className="font-medium">Vergleich mit letzter Evaluierung</p>
              <DeltaLine label="Trefferquote" current={passRate} previous={Math.round((prev!.passed / prev!.total) * 100)}
                prevDate={new Date(previousReport.timestamp).toLocaleDateString('de-DE')} />
              <DeltaLine label="Genauigkeit" current={top1Pct} previous={Math.round(prev!.top1Accuracy * 100)}
                prevDate={new Date(previousReport.timestamp).toLocaleDateString('de-DE')} />
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}

/* ─── Sub-Components ─── */

function MetricCard({ label, value, hint, hintTooltip, delta }: {
  label: string; value: string; hint: string; hintTooltip?: string; delta?: number;
}): React.ReactElement {
  return (
    <div className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-4">
      <div className="flex items-baseline gap-2">
        <p className="text-[22px] font-medium text-[var(--tf-text)]">{value}</p>
        {delta !== undefined && delta !== 0 && (
          <span className={`flex items-center gap-0.5 text-[11px] ${delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
            {delta > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {delta > 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      <p className="text-[12px] text-[var(--tf-text-tertiary)]">{label}</p>
      {hintTooltip ? (
        <Tooltip text={hintTooltip}>
          <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-0.5 cursor-help"
            style={{ borderBottom: '1px dotted var(--tf-text-tertiary)', display: 'inline' }}>
            {hint}
          </p>
        </Tooltip>
      ) : (
        <p className="text-[11px] text-[var(--tf-text-tertiary)] mt-0.5">{hint}</p>
      )}
    </div>
  );
}

function LabeledBar({ label, passed, total }: {
  label: React.ReactNode; passed: number; total: number;
}): React.ReactElement {
  const pct = total > 0 ? passed / total : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] text-[var(--tf-text)] w-48 shrink-0">{label}</span>
      <ProgressBar value={pct} label={`${passed}/${total}`} />
    </div>
  );
}

function DeltaLine({ label, current, previous, prevDate }: {
  label: string; current: number; previous: number; prevDate: string;
}): React.ReactElement {
  const delta = current - previous;
  return (
    <p>
      {label}: {current}%{' '}
      <span className={delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : ''}>
        ({delta > 0 ? '+' : ''}{delta}% seit {prevDate})
      </span>
    </p>
  );
}

/* ─── Result Table ─── */

function ResultTable({ results }: { results: TestCaseResult[] }): React.ReactElement {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="border border-[var(--tf-border)] rounded-[var(--tf-radius)] overflow-hidden">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-[var(--tf-bg-secondary)]">
            <th className="text-left p-2 font-medium text-[var(--tf-text-secondary)]">#</th>
            <th className="text-left p-2 font-medium text-[var(--tf-text-secondary)]">Query</th>
            <th className="text-center p-2 font-medium text-[var(--tf-text-secondary)]">Gefunden?</th>
            <th className="text-right p-2 font-medium text-[var(--tf-text-secondary)]">In Top 5</th>
          </tr>
        </thead>
        <tbody>
          {results.map(r => (
            <ResultRow key={r.testCase.id} result={r}
              isExpanded={expanded === r.testCase.id}
              onToggle={() => setExpanded(expanded === r.testCase.id ? null : r.testCase.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultRow({ result: r, isExpanded, onToggle }: {
  result: TestCaseResult; isExpanded: boolean; onToggle: () => void;
}): React.ReactElement {
  const tc = r.testCase;
  const inTop5 = `${r.expectedInTop5.length}/${tc.expectedDocs.length}`;
  const rowBg = r.pass ? '' : 'bg-[var(--tf-danger-bg)]';

  return (
    <>
      <tr className={`${rowBg} cursor-pointer hover:bg-[var(--tf-bg-secondary)] transition-colors`} onClick={onToggle}>
        <td className="p-2 text-[var(--tf-text)]">
          <span className="flex items-center gap-1">
            {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {tc.id}
          </span>
        </td>
        <td className="p-2 text-[var(--tf-text)]">{tc.query}</td>
        <td className="p-2 text-center">{r.pass ? '\u2705' : '\u274C'}</td>
        <td className="p-2 text-right text-[var(--tf-text-secondary)]">{inTop5}</td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={4} className="p-3 bg-[var(--tf-bg-secondary)]">
            <div className="space-y-2 text-[11px]">
              <p className="text-[var(--tf-text-secondary)]"><strong>Beschreibung:</strong> {tc.description}</p>
              <p className="text-[var(--tf-text-secondary)]"><strong>Erwartet:</strong> {tc.expectedDocs.join(', ')}</p>
              {tc.expectedTop1 && (
                <p className="text-[var(--tf-text-secondary)]">
                  <strong>Top-1 erwartet:</strong> {tc.expectedTop1} {r.top1Match ? '\u2705' : '\u274C'}
                </p>
              )}
              <div>
                <p className="text-[var(--tf-text-secondary)] font-medium mb-1">Top-5 Ergebnisse:</p>
                {r.results.slice(0, 5).map((res, i) => (
                  <p key={res.id} className="text-[var(--tf-text-tertiary)] pl-2">
                    {i + 1}. {res.source} <span className="text-[10px]">({res.score.toFixed(4)}, {res.method})</span>
                  </p>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
