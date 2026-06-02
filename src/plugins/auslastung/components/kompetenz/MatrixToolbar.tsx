/**
 * MatrixToolbar (v2.16) — Lead + Aktionen über der Matrix.
 *
 * Links die „Kompetenz-Vorbelegung"-Überschrift + Kurzbeschreibung, rechts
 * [XLSX hochladen] (öffnet den Dialog im View) + [Speichern] (committet den
 * geteilten Draft). Speichern + Dirty-Count + „✓ Gespeichert" lesen das
 * gemeinsame Modell, damit Zell-Edits und Toolbar synchron sind.
 */
import { Upload, Check, Info } from 'lucide-react';
import type { KompetenzMatrixModel } from '../../hooks/useKompetenzMatrixModel';

const INFO_TEXT =
  'Kompetenz-Level (1–3) je Unterkategorie, Antragstyp-Kontingent und Abschlag pro MA — als XLSX '
  + 'hochladen oder (im Bearbeiten-Modus) direkt in der Tabelle pflegen. Haupt-/Nebenkategorie wird '
  + 'live abgeleitet.';

interface Props {
  model: KompetenzMatrixModel;
  onOpenUpload: () => void;
}

export function MatrixToolbar({ model, onOpenUpload }: Props): React.ReactElement {
  const { save, dirtyCount, justSaved } = model;
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-1.5">
        <h2 className="text-[15px] font-medium text-[var(--tf-text)]">Kompetenz-Vorbelegung</h2>
        <span
          tabIndex={0}
          role="note"
          aria-label={INFO_TEXT}
          title={INFO_TEXT}
          className="inline-flex items-center text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)] cursor-help"
        >
          <Info size={14} />
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {justSaved && (
          <span className="flex items-center gap-1 text-[11.5px] text-[var(--tf-success-text)]">
            <Check size={13} /> Gespeichert
          </span>
        )}
        {dirtyCount > 0 && !justSaved && (
          <span className="text-[11.5px] text-[var(--tf-warning-text)]">{dirtyCount} ungespeichert</span>
        )}
        <button
          type="button"
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer"
          style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text)' }}
        >
          <Upload size={13} /> XLSX hochladen
        </button>
        <button
          type="button"
          onClick={() => save.run()}
          disabled={save.busy || dirtyCount === 0}
          className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-40"
          style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
        >
          {save.busy ? 'Speichere…' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}
