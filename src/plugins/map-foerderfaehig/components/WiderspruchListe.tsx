/**
 * Befundgruppe „VB ↔ Einreichungsdaten".
 *
 * Konfrontieren statt benoten: die Gruppe stellt Faktenseite und Textseite
 * nebeneinander und überlässt das Urteil dem Prüfer. Deshalb kein Score, keine
 * Prozentzahl, keine Ampel — und eine unübersehbare Kennzeichnung als
 * KI-Vorschlag.
 *
 * Der Leerfall ist ein ERGEBNIS, kein leerer Zustand: „keine Abweichung
 * gefunden" ist die Aussage, für die der Lauf gemacht wurde.
 *
 * Rein darstellend.
 */
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import type { VbSektion } from '@/plugins/antraege/aufbereitung/gliederung';
import type { Widerspruch } from '../infografik/substanz';
import { SektionChips } from './SektionChips';

const ART_LABEL: Record<Widerspruch['art'], string> = {
  zahl: 'Zahl',
  zeitraum: 'Zeitraum',
  bezeichnung: 'Bezeichnung',
};

export interface WiderspruchZeile {
  widerspruch: Widerspruch;
  /** Kriterium, an das der Befund gehängt werden kann; `null` = kein Treffer. */
  zielItemId: string | null;
  /** Anzeigename des Ziel-Kriteriums. */
  zielKriterium: string | null;
}

export function WiderspruchListe({
  zeilen, gliederung, lage, onUebernehmen,
}: {
  zeilen: readonly WiderspruchZeile[];
  gliederung: readonly VbSektion[];
  /** Steuert die Meldung, wenn (noch) kein Lauf vorliegt. */
  lage: 'aus' | 'laeuft' | 'ok' | 'fehler';
  onUebernehmen: (zeile: WiderspruchZeile) => void;
}): React.ReactElement {
  if (lage === 'laeuft') {
    return <p className="text-[13px] text-[var(--tf-text-secondary)]">Abgleich läuft …</p>;
  }

  if (lage === 'aus' || lage === 'fehler') {
    return (
      <p className="text-[13px] text-[var(--tf-text-secondary)]">
        {lage === 'fehler'
          ? 'Der Abgleich ist nicht verfügbar — die übrigen Prüfschritte sind davon unberührt.'
          : 'Der Abgleich entsteht im internen Analyse-Lauf über die Vorhabensbeschreibung —'
            + ' starten Sie ihn im Reiter „Vorhabensbeschreibung".'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11.5px] text-[var(--tf-text-tertiary)] flex items-center gap-1.5">
        <Sparkles size={12} />
        KI-Vorschlag — bitte prüfen. Verglichen wird der Fliesstext gegen die Angaben
        aus dem Einreichungsformular.
      </p>

      {zeilen.length === 0 && (
        <p className="text-[13px] text-[var(--tf-text-secondary)]">
          Keine Abweichung gefunden — der Text widerspricht den Einreichungsdaten an
          keiner Stelle.
        </p>
      )}

      {zeilen.map((zeile, i) => {
        const w = zeile.widerspruch;
        return (
          <div
            key={`${w.art}-${i}`}
            className="rounded-[var(--tf-radius-md,8px)] px-3 py-2.5"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex flex-col gap-1">
                <p className="text-[12.5px] text-[var(--tf-text)]">
                  <span className="text-[var(--tf-text-tertiary)]">Einreichung: </span>
                  {w.fakt}
                </p>
                <p className="text-[12.5px] text-[var(--tf-text)]">
                  <span className="text-[var(--tf-text-tertiary)]">Vorhabensbeschreibung: </span>
                  {w.aussageImText}
                </p>
              </div>
              <span className="text-[10.5px] text-[var(--tf-text-tertiary)] shrink-0 mt-0.5 font-mono">
                {ART_LABEL[w.art]}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <SektionChips sektionIds={w.sektionIds} gliederung={gliederung} />
              {zeile.zielItemId === null
                ? (
                  <span className="text-[11px] text-[var(--tf-text-tertiary)]">
                    Kein passendes Prüfkriterium gefunden — bitte von Hand zuordnen.
                  </span>
                )
                : (
                  <Button variant="ghost" size="sm" onClick={() => onUebernehmen(zeile)}>
                    Als Befund an „{zeile.zielKriterium}" hängen
                  </Button>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
