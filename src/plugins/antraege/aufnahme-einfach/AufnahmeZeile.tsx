/**
 * Eine Datei-Zeile der reduzierten Triage-Liste: Dateiname, FKZ-Chip (mit
 * Inline-Eingabe bei Problemfällen), Typ-Pills (Vorschlag aktiv), Status.
 * KEINE Bulk-Aktionen, KEINE Filter, KEINE Konfidenz.
 */
import { Loader2, Check, X } from 'lucide-react';
import { AUFNAHME_TYP_LABEL, type AufnahmeTyp } from './dateiTyp';
import type { IntakeFile } from './types';

const WAEHLBAR: AufnahmeTyp[] = ['vorhabensbeschreibung', 'teilvorhabensbeschreibung', 'stellungnahme'];

interface Props {
  item: IntakeFile;
  istValiderFkz: (fkz: string) => boolean;
  onSetFkz: (localId: string, fkz: string) => void;
  onSetTyp: (localId: string, typ: AufnahmeTyp) => void;
  onRemove: (localId: string) => void;
}

function StatusAnzeige({ item }: { item: IntakeFile }): React.ReactElement | null {
  switch (item.status) {
    case 'konvertiere':
      return <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-text-tertiary)]"><Loader2 size={12} className="animate-spin" /> konvertiere…</span>;
    case 'konvertiert':
      return <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-success-text)]"><Check size={12} /> konvertiert</span>;
    case 'uebersprungen':
      return <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">übersprungen</span>;
    case 'fehlgeschlagen':
      return (
        <span className="text-[11.5px] text-[var(--tf-danger-text)]" title={item.error}>
          fehlgeschlagen{item.error ? `: ${item.error}` : ''}
        </span>
      );
    default:
      return null;
  }
}

export function AufnahmeZeile({ item, istValiderFkz, onSetFkz, onSetTyp, onRemove }: Props): React.ReactElement {
  const fkzGueltig = !!item.fkz && istValiderFkz(item.fkz);
  const busy = item.status === 'konvertiere';

  return (
    <div className="flex items-start gap-3 py-2.5 border-b-[0.5px] border-[var(--tf-border)] last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] text-[var(--tf-text)] truncate" title={item.name}>{item.name}</div>

        {/* FKZ-Zeile */}
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {fkzGueltig ? (
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-[var(--tf-bg-secondary)] text-[var(--tf-text)]">{item.fkz}</span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">
                {item.fkz ? 'unbekanntes FKZ' : 'kein FKZ'}
              </span>
              <input
                type="text"
                defaultValue={item.fkz ?? ''}
                onChange={e => onSetFkz(item.localId, e.target.value)}
                placeholder="FKZ eintragen"
                className="h-6 w-[140px] rounded-md border-[0.5px] border-[var(--tf-border)] bg-transparent px-2 text-[11.5px] font-mono focus:border-[var(--tf-primary)] outline-none"
                aria-label="Förderkennzeichen eintragen"
              />
              {item.fkz && !fkzGueltig ? (
                <span className="text-[10.5px] text-[var(--tf-danger-text)]">ungültiges Format</span>
              ) : null}
            </span>
          )}
        </div>

        {/* Typ-Pills */}
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          {WAEHLBAR.map(typ => {
            const active = item.typ === typ;
            return (
              <button
                key={typ}
                type="button"
                aria-pressed={active}
                onClick={() => onSetTyp(item.localId, typ)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] border-[0.5px] transition-colors ${
                  active
                    ? 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)] border-transparent'
                    : 'bg-transparent text-[var(--tf-text-secondary)] border-[var(--tf-border)] hover:border-[var(--tf-border-hover)]'
                }`}
              >
                {AUFNAHME_TYP_LABEL[typ]}
              </button>
            );
          })}
          {item.typ === 'unklar' ? (
            <span className="text-[10.5px] text-[var(--tf-warning-text)]">Typ wählen</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onRemove(item.localId)}
          disabled={busy}
          aria-label="Aus Liste entfernen"
          className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] disabled:opacity-40"
        >
          <X size={14} />
        </button>
        <StatusAnzeige item={item} />
      </div>
    </div>
  );
}
