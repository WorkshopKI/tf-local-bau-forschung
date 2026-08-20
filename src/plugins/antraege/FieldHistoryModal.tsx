/**
 * Das Fenster hinter dem `↻ N`-Knopf in „Alle Felder": die belegten Änderungen
 * EINES Feldes.
 *
 * Die Einträge kommen fertig herein (`useFeldHistorie`) statt hier noch einmal
 * gelesen zu werden — der Knopf und das Fenster müssen aus derselben Quelle
 * sprechen, sonst zeigt der eine „↻ 3" und das andere „Keine Einträge". Genau
 * dieser Bruch bestand bis v4.122: der Zähler kam (am Verbund) aus einem fest
 * verdrahteten `{}`, das Fenster aus dem nie befüllten IDB-Store.
 *
 * Der Nullpunkt steht dabei — eine Chronik ohne ihn liest sich als vollständige.
 */
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { FeldHistorieEintrag } from './alleFelder/useFeldHistorie';
import { nullpunktText } from './status/journalTexte';

interface Props {
  aktenzeichen: string;
  feld: string | null;
  /** Beschriftung des Feldes (Titel); ohne Angabe der Record-Key. */
  feldLabel?: string;
  eintraege: readonly FeldHistorieEintrag[];
  journalAb: string | null;
  gefuehrt: boolean;
  /** Zeigt mehr als ein Aktenzeichen (Verbund) — dann gehört die Quelle an die Zeile. */
  mehrereAntraege?: boolean;
  onClose: () => void;
}

export function FieldHistoryModal({
  aktenzeichen, feld, feldLabel, eintraege, journalAb, gefuehrt, mehrereAntraege, onClose,
}: Props): React.ReactElement {
  return (
    <Dialog
      open={!!feld}
      onClose={onClose}
      title={`Historie: ${feldLabel ?? feld}`}
      description={aktenzeichen}
      className="max-w-[600px]"
      footer={<Button size="sm" variant="default" onClick={onClose}>Schließen</Button>}
    >
      <p className="mb-2 text-[11px] text-[var(--tf-text-tertiary)]">
        {nullpunktText(journalAb, gefuehrt)}
      </p>
      {eintraege.length === 0 ? (
        <div className="text-[13px] text-[var(--tf-text-tertiary)]">
          Für dieses Feld ist seit dem Nullpunkt keine Änderung belegt.
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto">
          {eintraege.map(e => (
            <div key={e.id} className="p-3 rounded-lg bg-[var(--tf-bg-secondary)] text-[12.5px]">
              <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">
                {e.art} {e.wann}{mehrereAntraege ? ` · ${e.quelle}` : ''}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="line-through text-[var(--tf-text-tertiary)]">{e.alt}</span>
                <span className="text-[var(--tf-text)]">→ {e.neu}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
