/**
 * Aufnahme-Panel: Drop-Fläche (Dateien oder EIN ZIP) → reduzierte Triage-Liste →
 * „Konvertieren & ablegen" (sequenziell, mit Fortschritt + Abbrechen) → Bestand.
 */
import { Loader2, Upload } from 'lucide-react';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { AufnahmeZeile } from './AufnahmeZeile';
import { BestandsBlock } from './BestandsBlock';
import type { UseAufnahme } from './useAufnahme';

export function AufnahmePanel({ a }: { a: UseAufnahme }): React.ReactElement {
  const ablegbar = a.items.filter(it => !!it.fkz && a.istValiderFkz(it.fkz) && it.typ !== 'unklar').length;
  const busy = a.konvertieren.busy;

  return (
    <div>
      <h2 className="text-[18px] font-medium text-[var(--tf-text)] mb-1">Dokumente aufnehmen</h2>
      <p className="text-[13px] text-[var(--tf-text-secondary)] mb-4">
        Antragsdokumente als ZIP (oder einzelne PDF/DOCX) ablegen. Das Förderkennzeichen wird aus dem Dateinamen erkannt;
        die Dokumente werden in Ihren persönlichen Ordner konvertiert.
      </p>

      <FileDropZone onFiles={files => a.addDrop(files)} accept=".pdf,.docx,.zip" multiple>
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Upload size={22} className="text-[var(--tf-text-tertiary)]" />
          <p className="text-[13px] text-[var(--tf-text-secondary)]">ZIP oder Dateien hier ablegen</p>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">PDF und DOCX · Unterordner werden einbezogen</p>
        </div>
      </FileDropZone>

      {a.meldungen.length > 0 && (
        <ul className="mt-3 space-y-0.5">
          {a.meldungen.map((m, i) => (
            <li key={i} className="text-[11.5px] text-[var(--tf-text-tertiary)]">· {m}</li>
          ))}
        </ul>
      )}

      {a.items.length > 0 && (
        <div className="mt-5">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] mb-1">
            {a.items.length} {a.items.length === 1 ? 'Datei' : 'Dateien'}
          </div>
          <div>
            {a.items.map(it => (
              <AufnahmeZeile
                key={it.localId}
                item={it}
                istValiderFkz={a.istValiderFkz}
                onSetFkz={a.setFkz}
                onSetTyp={a.setTyp}
                onRemove={a.entfernen}
              />
            ))}
          </div>

          {a.konvertieren.error && (
            <div className="mt-3 rounded p-2.5 text-[12px]" style={{ background: '#fee2e2', color: '#991b1b', border: '0.5px solid #fca5a5' }}>
              ⚠ {a.konvertieren.error}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => a.konvertieren.run()}
              disabled={busy || ablegbar === 0}
              className="px-4 py-2 rounded-lg text-[13.5px] bg-[var(--tf-text)] text-[var(--tf-bg)] disabled:opacity-40"
            >
              {busy ? 'Konvertiere…' : `Konvertieren & ablegen (${ablegbar})`}
            </button>
            {busy && a.fortschritt && (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-tertiary)]">
                <Loader2 size={12} className="animate-spin" />
                {a.fortschritt.aktuell + 1}/{a.fortschritt.gesamt} · {a.fortschritt.name}
                <button type="button" onClick={a.abbrechen} className="ml-2 underline hover:text-[var(--tf-text-secondary)]">Abbrechen</button>
              </span>
            )}
            {ablegbar === 0 && a.items.length > 0 && !busy && (
              <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">FKZ + Typ je Datei setzen, um abzulegen.</span>
            )}
          </div>
        </div>
      )}

      <BestandsBlock reloadSignal={a.items.length} />
    </div>
  );
}
