/**
 * Der **Vorgangsverlauf** als Raster — reine Anzeige.
 *
 * Zweispaltig (Bezeichnung | Wert), weil die Aufstellung zum Nachschlagen da
 * ist: das Auge läuft die linke Spalte hinunter, bis es die Zeile findet, die
 * es sucht. Feldkürzel in Mono direkt hinter dem Wert — sie sind der Griff für
 * die Rückfrage ans Fachsystem, nicht Zierat.
 */
import { formatDatumsWert } from '@/core/services/csv/dateParse';
import type { RasterZeile, VorgangsverlaufModell } from './vorgangsverlaufModell';

/** Datumswerte einheitlich formatieren, alles andere unverändert lassen. */
function wertText(wert: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(wert) ? formatDatumsWert(wert) : wert;
}

function Zeile({ z, erste }: { z: RasterZeile; erste: boolean }): React.ReactElement {
  const rand = erste ? undefined : '0.5px solid var(--tf-border)';
  return (
    <>
      <div
        className="px-[13px] py-2 text-[12.5px] text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)]"
        style={{ borderTop: rand }}
      >
        {z.label}
      </div>
      <div
        className="px-[13px] py-2 text-[12.5px] flex items-baseline gap-2 flex-wrap min-w-0"
        style={{ borderTop: rand }}
      >
        <span className={z.weich ? 'text-[var(--tf-text-tertiary)]' : 'text-[var(--tf-text)]'}
          style={z.stark ? { fontWeight: 500 } : undefined}
        >
          {wertText(z.wert)}
        </span>
        {z.feld !== undefined && (
          <code className="font-mono text-[11px] text-[var(--tf-text-tertiary)]">{z.feld}</code>
        )}
        {z.zusatz !== undefined && (
          <span className="text-[12px] text-[var(--tf-text-secondary)]">{z.zusatz}</span>
        )}
      </div>
    </>
  );
}

export function VorgangsRaster({ modell, onZeitverlauf }: {
  modell: VorgangsverlaufModell;
  /** Wechselt auf den Zeitverlauf; `null` = es gibt keinen (Flag aus). */
  onZeitverlauf: (() => void) | null;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2.5">
      <div
        className="grid rounded-[10px] overflow-hidden"
        style={{ gridTemplateColumns: '190px 1fr', border: '0.5px solid var(--tf-border)' }}
      >
        {modell.zeilen.map((z, i) => <Zeile key={z.label} z={z} erste={i === 0} />)}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {modell.legende.map(l => (
          <span
            key={l.text}
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-[var(--tf-text-secondary)]"
          >
            <span
              className="shrink-0 w-[7px] h-[7px] rounded-full"
              style={{ background: l.farbe }}
              aria-hidden="true"
            />
            {l.text}
          </span>
        ))}
      </div>

      {onZeitverlauf !== null && (
        <button
          type="button"
          onClick={onZeitverlauf}
          className="self-start text-[12px] text-[var(--tf-primary)] cursor-pointer hover:underline underline-offset-2"
        >
          Dieselben Daten als Zeitverlauf ansehen →
        </button>
      )}
    </div>
  );
}
