import { useState } from 'react';
import { Download, ChevronDown, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/ui';
import type { EvalReport, TestCaseResult } from '@/core/services/search/eval/eval-types';
import { evalToMarkdown, evalToJSON, downloadAsFile } from '@/core/services/search/eval/eval-export';

interface EvalResultViewProps {
  report: EvalReport;
  previousReport?: EvalReport;
}

export function EvalResultView({ report, previousReport }: EvalResultViewProps): React.ReactElement {
  const s = report.summary;

  return (
    <div className="space-y-6">
      <SummaryCards summary={s} previousReport={previousReport} />
      <CategoryBars data={s.byCategory} label="Nach Kategorie" />
      <CategoryBars data={s.byDifficulty} label="Nach Schwierigkeit" />
      <ResultTable results={report.results} />
      <ExportSection report={report} />
    </div>
  );
}

/* ─── Summary Cards ─── */

function SummaryCards({ summary: s, previousReport }: {
  summary: EvalReport['summary']; previousReport?: EvalReport;
}): React.ReactElement {
  const prev = previousReport?.summary;
  const pct = (v: number): string => `${Math.round(v * 100)}%`;

  return (
    <div className="grid grid-cols-4 gap-3">
      <MetricCard label="Bestanden" value={`${s.passed}/${s.total}`}
        delta={prev ? s.passed - prev.passed : undefined} />
      <MetricCard label="P@3" value={pct(s.avgPrecision3)}
        delta={prev ? Math.round((s.avgPrecision3 - prev.avgPrecision3) * 100) : undefined} suffix="%" />
      <MetricCard label="P@5" value={pct(s.avgPrecision5)}
        delta={prev ? Math.round((s.avgPrecision5 - prev.avgPrecision5) * 100) : undefined} suffix="%" />
      <MetricCard label="Top-1" value={pct(s.top1Accuracy)}
        delta={prev ? Math.round((s.top1Accuracy - prev.top1Accuracy) * 100) : undefined} suffix="%" />
    </div>
  );
}

function MetricCard({ label, value, delta, suffix }: {
  label: string; value: string; delta?: number; suffix?: string;
}): React.ReactElement {
  return (
    <div className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-3">
      <div className="flex items-baseline gap-1">
        <p className="text-[20px] font-medium text-[var(--tf-text)]">{value}</p>
        {delta !== undefined && delta !== 0 && (
          <span className={`flex items-center text-[11px] ${delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
            {delta > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {delta > 0 ? '+' : ''}{delta}{suffix ?? ''}
          </span>
        )}
      </div>
      <p className="text-[11px] text-[var(--tf-text-tertiary)]">{label}</p>
    </div>
  );
}

/* ─── Category Bars ─── */

function CategoryBars({ data, label }: {
  data: Record<string, { total: number; passed: number }>; label: string;
}): React.ReactElement {
  return (
    <div>
      <p className="text-[12px] font-medium text-[var(--tf-text-secondary)] mb-2">{label}</p>
      <div className="space-y-2">
        {Object.entries(data).map(([name, { total, passed }]) => {
          const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
          return (
            <div key={name} className="flex items-center gap-3">
              <span className="text-[12px] text-[var(--tf-text)] w-20">{name}</span>
              <div className="flex-1 h-1 bg-[var(--tf-bg-secondary)] rounded-sm overflow-hidden">
                <div className="h-full bg-[var(--tf-text)] rounded-sm transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[11px] text-[var(--tf-text-tertiary)] w-16 text-right">
                {passed}/{total} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Result Table ─── */

function ResultTable({ results }: { results: TestCaseResult[] }): React.ReactElement {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div>
      <p className="text-[12px] font-medium text-[var(--tf-text-secondary)] mb-2">Einzelergebnisse</p>
      <div className="border border-[var(--tf-border)] rounded-[var(--tf-radius)] overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[var(--tf-bg-secondary)]">
              <th className="text-left p-2 font-medium text-[var(--tf-text-secondary)]">#</th>
              <th className="text-left p-2 font-medium text-[var(--tf-text-secondary)]">Query</th>
              <th className="text-left p-2 font-medium text-[var(--tf-text-secondary)]">Top-1</th>
              <th className="text-center p-2 font-medium text-[var(--tf-text-secondary)]">Pass</th>
              <th className="text-right p-2 font-medium text-[var(--tf-text-secondary)]">P@5</th>
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
    </div>
  );
}

function ResultRow({ result: r, isExpanded, onToggle }: {
  result: TestCaseResult; isExpanded: boolean; onToggle: () => void;
}): React.ReactElement {
  const tc = r.testCase;
  const top1 = r.results[0]?.source ?? '-';
  const truncatedTop1 = top1.length > 30 ? top1.slice(0, 27) + '...' : top1;
  const truncatedQuery = tc.query.length > 30 ? tc.query.slice(0, 27) + '...' : tc.query;
  const rowBg = r.pass ? '' : 'bg-[var(--tf-danger-bg)]';

  return (
    <>
      <tr className={`${rowBg} cursor-pointer hover:bg-[var(--tf-bg-secondary)] transition-colors`}
        onClick={onToggle}>
        <td className="p-2 text-[var(--tf-text)]">
          <span className="flex items-center gap-1">
            {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {tc.id}
          </span>
        </td>
        <td className="p-2 text-[var(--tf-text)]" title={tc.query}>{truncatedQuery}</td>
        <td className="p-2 text-[var(--tf-text-secondary)]" title={top1}>{truncatedTop1}</td>
        <td className="p-2 text-center">{r.pass ? '\u2705' : '\u274C'}</td>
        <td className="p-2 text-right text-[var(--tf-text-secondary)]">{Math.round(r.precision5 * 100)}%</td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={5} className="p-3 bg-[var(--tf-bg-secondary)]">
            <div className="space-y-2 text-[11px]">
              <p className="text-[var(--tf-text-secondary)]"><strong>Beschreibung:</strong> {tc.description}</p>
              <p className="text-[var(--tf-text-secondary)]"><strong>Erwartet:</strong> {tc.expectedDocs.join(', ')}</p>
              {tc.expectedTop1 && (
                <p className="text-[var(--tf-text-secondary)]">
                  <strong>Top-1 erwartet:</strong> {tc.expectedTop1} {r.top1Match ? '\u2705' : '\u274C'}
                </p>
              )}
              <p className="text-[var(--tf-text-secondary)]">
                <strong>Gefunden in Top-5:</strong> {r.expectedInTop5.length > 0 ? r.expectedInTop5.join(', ') : 'Keine'}
              </p>
              <div>
                <p className="text-[var(--tf-text-secondary)] font-medium mb-1">Top-5 Ergebnisse:</p>
                {r.results.slice(0, 5).map((res, i) => (
                  <p key={res.id} className="text-[var(--tf-text-tertiary)] pl-2">
                    {i + 1}. {res.source} <span className="text-[10px]">(score: {res.score.toFixed(4)}, {res.method})</span>
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

/* ─── Export ─── */

function ExportSection({ report }: { report: EvalReport }): React.ReactElement {
  return (
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
  );
}
