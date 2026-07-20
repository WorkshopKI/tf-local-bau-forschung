/**
 * Import-Report: was der Adapter erkannt, gegriffen, vermisst und verworfen hat.
 *
 * Das ist die ehrliche Selbstauskunft des Imports und zugleich eine Demo-Station:
 * ein Plattform-Update heisst nicht Stillstand, sondern eine sichtbare Liste von
 * Abweichungen. Rein darstellend.
 */
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import type { MapImportReport, MapSchwere } from '../types';

const MELDUNGS_FARBE: Record<MapSchwere, string> = {
  fehler: 'var(--tf-danger, #dc2626)',
  warnung: 'var(--tf-warning, #f59e0b)',
  hinweis: 'var(--tf-text-tertiary)',
};

function Zeile({ links, rechts }: { links: string; rechts: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-[12.5px] text-[var(--tf-text-secondary)] font-mono">{links}</span>
      <span className="text-[12.5px] text-[var(--tf-text)] text-right">{rechts}</span>
    </div>
  );
}

export function ImportReportPanel({ report }: { report: MapImportReport }): React.ReactElement {
  const { erkennung } = report;
  const aliasse = report.zielfelder.filter(z => z.status === 'alias');
  const fehlend = report.zielfelder.filter(z => z.status === 'fehlend');

  const erkennungsText = erkennung.schemaId === null
    ? 'nicht erkannt'
    : erkennung.kandidaten.find(k => k.id === erkennung.schemaId)?.label ?? erkennung.schemaId;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-[var(--tf-text)]">{erkennungsText}</span>
          <span
            className="text-[11.5px] px-1.5 py-0.5 rounded"
            style={{
              color: erkennung.eindeutig ? 'var(--tf-success, #16a34a)' : 'var(--tf-warning, #f59e0b)',
              background: erkennung.eindeutig
                ? 'color-mix(in srgb, var(--tf-success, #16a34a) 12%, var(--tf-bg))'
                : 'color-mix(in srgb, var(--tf-warning, #f59e0b) 12%, var(--tf-bg))',
            }}
          >
            {erkennung.eindeutig ? 'eindeutig' : 'unsicher'}
          </span>
          <span className="text-[12px] text-[var(--tf-text-tertiary)]">aus {report.dateiname}</span>
        </div>

        <div className="mt-2 flex flex-col gap-1">
          {erkennung.kandidaten.map(k => (
            <div key={k.id} className="text-[12px] text-[var(--tf-text-secondary)]">
              {k.label}: {k.treffer} von {k.marker.length} Erkennungsmerkmalen
              {k.marker.some(m => !m.vorhanden) && (
                <span className="text-[var(--tf-text-tertiary)]">
                  {' '}(fehlt: {k.marker.filter(m => !m.vorhanden).map(m => m.pfad).join(', ')})
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {report.meldungen.length > 0 && (
        <ul className="flex flex-col gap-1">
          {report.meldungen.map((m, i) => (
            <li key={`${m.schwere}-${i}`} className="text-[12.5px]" style={{ color: MELDUNGS_FARBE[m.schwere] }}>
              {m.text}
              {m.kontext != null && (
                <span className="text-[var(--tf-text-tertiary)] font-mono"> — {m.kontext}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <CollapsibleSection label={`Feld-Aliasse (${aliasse.length})`} defaultOpen={aliasse.length > 0}>
        {aliasse.length === 0
          ? <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
              Alle Felder kamen über ihren Primärpfad — die Datei folgt der erwarteten Struktur.
            </p>
          : aliasse.map(z => <Zeile key={z.ziel} links={z.ziel} rechts={z.benutzterPfad} />)}
      </CollapsibleSection>

      <CollapsibleSection label={`Fehlende Felder (${fehlend.length})`} defaultOpen={fehlend.some(z => z.pflicht)}>
        {fehlend.length === 0
          ? <p className="text-[12.5px] text-[var(--tf-text-secondary)]">Kein erwartetes Feld fehlt.</p>
          : fehlend.map(z => (
              <Zeile
                key={z.ziel}
                links={z.ziel}
                rechts={z.pflicht
                  ? <span style={{ color: 'var(--tf-danger, #dc2626)' }}>Pflichtfeld</span>
                  : <span className="text-[var(--tf-text-tertiary)]">optional</span>}
              />
            ))}
      </CollapsibleSection>

      <CollapsibleSection label={`Nicht ausgewertete Bereiche (${report.unbekannteFelder.length})`}>
        <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-1.5">
          Diese Bereiche stehen in der Einreichung, werden von der Prüfung aber nicht gelesen.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {report.unbekannteFelder.map(b => (
            <span key={b} className="text-[11.5px] font-mono px-1.5 py-0.5 rounded bg-[var(--tf-bg-secondary,var(--tf-bg))] text-[var(--tf-text-secondary)]">
              {b}
            </span>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection label={`Aus Datenschutzgründen verworfen (${report.redaktion.verworfenePfade.length})`}>
        <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-1.5">
          Personalbögen, Bankverbindung, Ansprechpartner und Telemetrie werden nicht
          importiert. Übernommen werden nur Personenmonats-Summen und Personalnummer
          beziehungsweise das N.N.-Kennzeichen.
        </p>
        <details>
          <summary className="text-[12px] text-[var(--tf-primary)] cursor-pointer">
            Verworfene Quellpfade anzeigen
          </summary>
          <div className="mt-1.5 max-h-48 overflow-y-auto flex flex-col gap-0.5">
            {report.redaktion.verworfenePfade.map(p => (
              <span key={p} className="text-[11px] font-mono text-[var(--tf-text-tertiary)]">{p}</span>
            ))}
          </div>
        </details>
      </CollapsibleSection>
    </div>
  );
}
