/**
 * Detail einer Anfrage: prominenter (farbiger) Status + Schritt-für-Schritt-
 * Fortschritt, darunter die einklappbaren Abschnitte (Stammdaten · Mailtext ·
 * Anonymisierung · Antwort & Finalisierung). Löschen im Header (Inline-
 * Bestätigung). Phasenspezifische Aktionen leben in den Unter-Komponenten.
 */
import { X } from 'lucide-react';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import type { Anfrage } from './types';
import { STATUS_LABEL, STATUS_REIHENFOLGE, statusErreicht, statusIndex } from './status';
import { AnfrageStatusBadge } from './AnfrageStatusBadge';
import { AnfrageDeleteControl } from './AnfrageDeleteControl';
import { formatAnfrageDatum } from './format';
import { AnfrageAnonymisierung } from './AnfrageAnonymisierung';
import { RueckimportFinalisierung } from './RueckimportFinalisierung';

interface Props {
  anfrage: Anfrage;
  onClose: () => void;
}

function Stepper({ aktuell }: { aktuell: number }): React.ReactElement {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-5">
      {STATUS_REIHENFOLGE.map((s, i) => {
        const erledigt = i < aktuell;
        const istAktuell = i === aktuell;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10.5px] border ${
                istAktuell
                  ? 'border-[var(--tf-text)] text-[var(--tf-text)] font-medium'
                  : erledigt
                    ? 'border-[var(--tf-border)] text-[var(--tf-text-secondary)]'
                    : 'border-[var(--tf-border)] text-[var(--tf-text-tertiary)]'
              }`}
              style={{ borderWidth: 0.5 }}
            >
              {i + 1}
            </span>
            <span
              className={`text-[12px] ${
                istAktuell ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-tertiary)]'
              }`}
            >
              {STATUS_LABEL[s]}
            </span>
            {i < STATUS_REIHENFOLGE.length - 1 && (
              <span className="text-[var(--tf-text-tertiary)] text-[11px]">›</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function AnfrageDetail({ anfrage, onClose }: Props): React.ReactElement {
  const aktuell = statusIndex(anfrage.status);
  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-5">
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[16px] font-medium text-[var(--tf-text)]">
              {anfrage.betreff || '(ohne Betreff)'}
            </h2>
            <AnfrageStatusBadge status={anfrage.status} />
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <AnfrageDeleteControl anfrage={anfrage} onDeleted={onClose} />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-[var(--tf-radius)] text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] cursor-pointer"
            title="Schließen"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <Stepper aktuell={aktuell} />

      <CollapsibleSection label="Stammdaten" storageKey="anfrage-detail-stammdaten" defaultOpen>
        <dl className="text-[12.5px] space-y-1.5">
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-[var(--tf-text-tertiary)]">Absender</dt>
            <dd className="text-[var(--tf-text)] break-all">{anfrage.absenderEmail || '—'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-[var(--tf-text-tertiary)]">Aufgenommen</dt>
            <dd className="text-[var(--tf-text-secondary)]">{formatAnfrageDatum(anfrage.erstelltAm)}</dd>
          </div>
          {anfrage.hatAnhaenge > 0 && (
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-[var(--tf-text-tertiary)]">Anhänge</dt>
              <dd className="text-[var(--tf-text-secondary)]">
                {anfrage.hatAnhaenge} — werden nicht verarbeitet
              </dd>
            </div>
          )}
        </dl>
      </CollapsibleSection>

      <CollapsibleSection label="Mailtext" storageKey="anfrage-detail-mailtext" defaultOpen>
        <div className="text-[12.5px] text-[var(--tf-text)] whitespace-pre-wrap rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)] p-3 max-h-[40vh] overflow-y-auto">
          {anfrage.originalMd || <span className="text-[var(--tf-text-tertiary)]">— kein Text —</span>}
        </div>
      </CollapsibleSection>

      <CollapsibleSection label="Anonymisierung" storageKey="anfrage-detail-anon" defaultOpen>
        <AnfrageAnonymisierung anfrage={anfrage} />
      </CollapsibleSection>

      {statusErreicht(anfrage.status, 'export_freigegeben') && (
        <CollapsibleSection label="Antwort & Finalisierung" storageKey="anfrage-detail-antwort" defaultOpen>
          <RueckimportFinalisierung anfrage={anfrage} />
        </CollapsibleSection>
      )}
    </div>
  );
}
