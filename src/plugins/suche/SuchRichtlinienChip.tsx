/**
 * Der Richtlinien-Chip über der Trefferliste.
 *
 * Bindet die Richtlinien-Auswahl der Suche an den geteilten
 * [BereichAuswahlChip](@/components/bereich/BereichAuswahlChip); die
 * Darstellung steht dort, die Wirkung in
 * [richtlinienWahl.ts](./richtlinienWahl.ts).
 *
 * Er steht bewusst NEBEN den Facetten und nicht in ihnen: Facetten gelten für
 * eine Anfrage, diese Auswahl gilt bis auf Widerruf. Zwei Lebensdauern im
 * selben Menü wären genau die Verwechslung, die niemand zurücknimmt.
 */
import { BereichAuswahlChip } from '@/components/bereich/BereichAuswahlChip';
import type { Bereich } from '@/core/hooks/useBereich';

export function SuchRichtlinienChip({ bereich, ausgeblendet }: {
  bereich: Bereich;
  /** Wie viele Treffer die Auswahl gerade wegnimmt. */
  ausgeblendet: number;
}): React.ReactElement {
  return (
    <BereichAuswahlChip
      bereich={bereich}
      ausgeblendet={ausgeblendet}
      grundModus="alle"
      praefix="Treffer"
      einleitung={(
        <>
          Diese Auswahl bestimmt, welche <strong>Richtlinien in der Trefferliste</strong>
          {' '}stehen — und sie bleibt gemerkt. Voreingestellt ist der ganze Bestand: die Suche
          soll finden, was es gibt, auch in stillgelegten Altprogrammen.
        </>
      )}
    />
  );
}
