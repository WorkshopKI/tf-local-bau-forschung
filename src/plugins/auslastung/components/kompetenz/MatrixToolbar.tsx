/**
 * MatrixToolbar (v2.31) — Lead + Aktionen über der Matrix.
 *
 * Links die „Kompetenz-Vorbelegung"-Überschrift + Kurzbeschreibung, rechts
 * [XLSX hochladen] (öffnet den Dialog im View) + Auto-Save-Status. Edits werden
 * automatisch auf den Daten-Share geschrieben (kein Pflicht-Klick mehr); der
 * Button „Jetzt speichern" erzwingt den sofortigen Commit. Status + Fehler lesen
 * das gemeinsame Modell, damit Zell-Edits und Toolbar synchron sind.
 */
import { Upload, Check, Info, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { KompetenzMatrixModel } from '../../hooks/useKompetenzMatrixModel';

const INFO_TEXT =
  'Kompetenz-Level (1–3) je Unterkategorie, Antragstyp-Kontingent und Abschlag pro MA — als XLSX '
  + 'hochladen oder (im Bearbeiten-Modus) direkt in der Tabelle pflegen. Änderungen werden automatisch '
  + 'gespeichert; Haupt-/Nebenkategorie wird live abgeleitet.';

interface Props {
  model: KompetenzMatrixModel;
  onOpenUpload: () => void;
}

export function MatrixToolbar({ model, onOpenUpload }: Props): React.ReactElement {
  const { saving, dirtyCount, justSaved, saveError, flushNow, clearSaveError } = model;
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
        {saveError ? (
          <button
            type="button"
            onClick={clearSaveError}
            title={saveError}
            className="flex items-center gap-1 text-[11.5px] text-[var(--tf-danger-text)] cursor-pointer max-w-[280px] truncate"
          >
            <AlertTriangle size={13} /> Nicht gespeichert
          </button>
        ) : saving ? (
          <span className="flex items-center gap-1 text-[11.5px] text-[var(--tf-text-secondary)]">
            <Loader2 size={13} className="animate-spin" /> Speichert…
          </span>
        ) : dirtyCount > 0 ? (
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">Auto-Save…</span>
        ) : justSaved ? (
          <span className="flex items-center gap-1 text-[11.5px] text-[var(--tf-success-text)]">
            <Check size={13} /> Gespeichert
          </span>
        ) : null}
        <button
          type="button"
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer"
          style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text)' }}
        >
          <Upload size={13} /> XLSX hochladen
        </button>
        <Button
          variant="primary"
          size="sm"
          disabled={saving || dirtyCount === 0}
          onClick={flushNow}
        >
          Jetzt speichern
        </Button>
      </div>
    </div>
  );
}
