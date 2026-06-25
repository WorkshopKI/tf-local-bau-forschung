/**
 * Detail einer Anfrage: Schritt-für-Schritt-Status entlang `status` + die
 * aufgenommenen Felder. Die phasenspezifischen Aktionen (Anonymisieren,
 * Review/Export, Rückimport, Ausgabe) werden in späteren Phasen angedockt.
 */
import { X } from 'lucide-react';
import type { Anfrage } from './types';
import { STATUS_LABEL, STATUS_REIHENFOLGE, statusErreicht, statusIndex } from './status';
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
        <h2 className="text-[16px] font-medium text-[var(--tf-text)]">
          {anfrage.betreff || '(ohne Betreff)'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 p-1 rounded-[var(--tf-radius)] text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] cursor-pointer"
          title="Schließen"
        >
          <X size={16} />
        </button>
      </header>

      <Stepper aktuell={aktuell} />

      <dl className="text-[12.5px] mb-4 space-y-1.5">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-[var(--tf-text-tertiary)]">Absender</dt>
          <dd className="text-[var(--tf-text)]">{anfrage.absenderEmail || '—'}</dd>
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

      <section>
        <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)] mb-1.5">Mailtext</h3>
        <div className="text-[12.5px] text-[var(--tf-text)] whitespace-pre-wrap rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)] p-3 max-h-[40vh] overflow-y-auto">
          {anfrage.originalMd || <span className="text-[var(--tf-text-tertiary)]">— kein Text —</span>}
        </div>
      </section>

      <AnfrageAnonymisierung anfrage={anfrage} />

      {statusErreicht(anfrage.status, 'export_freigegeben') && (
        <RueckimportFinalisierung anfrage={anfrage} />
      )}
    </div>
  );
}
