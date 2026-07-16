/**
 * Zeigt die geernteten Roh-Tabellen des Runs als Markdown-Pipe-Tabellen (Paket 5,
 * Phase 4.2) — für den ehrlichen „nicht auslesbar"-Fall UND als manuelle Übersteuerung
 * (Prüfer will die Quelle mit dem Gantt vergleichen). Reine Präsentation über den
 * bestehenden `MarkdownRenderer` (sanitized, Tabellen-Support). Bevorzugt die
 * zeitplan-relevanten Tabellen; sonst alle.
 */
import { useMemo } from 'react';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { tabelleAlsMarkdown } from './zeitplan-qualitaet';
import type { RunTabelle, TabellenKlasse } from './types';

const ZEITPLAN_KLASSEN: ReadonlySet<TabellenKlasse> = new Set<TabellenKlasse>([
  'anlage5', 'ap-zeitplan-text', 'ap-taetigkeiten',
]);

const KLASSE_LABEL: Partial<Record<TabellenKlasse, string>> = {
  anlage5: 'Anlage 5 (Arbeitsplan)',
  'ap-zeitplan-text': 'Projektplan (VB-Text)',
  'ap-taetigkeiten': 'AP-Tätigkeiten',
  risiko: 'Risiken',
  'auftraege-dritte': 'Aufträge an Dritte',
  unbekannt: 'Tabelle',
};

export function Rohtabellen({ tabellen, className }: { tabellen: RunTabelle[]; className?: string }): React.ReactElement | null {
  const auswahl = useMemo(() => {
    const relevant = tabellen.filter(t => ZEITPLAN_KLASSEN.has(t.klasse));
    return relevant.length > 0 ? relevant : tabellen;
  }, [tabellen]);

  if (auswahl.length === 0) return null;

  return (
    <div className={className}>
      <div className="flex flex-col gap-4">
        {auswahl.map((t, i) => {
          const md = tabelleAlsMarkdown(t);
          if (!md) return null;
          return (
            <div key={i}>
              <div className="mb-1 text-[11.5px] font-medium uppercase tracking-wide text-[var(--tf-text-tertiary)]">
                {KLASSE_LABEL[t.klasse] ?? 'Tabelle'} · {t.rolle === 'vb' ? 'VB' : 'Anlage 5'}
              </div>
              <div className="overflow-x-auto text-[12px]">
                <MarkdownRenderer content={md} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
