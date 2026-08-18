/**
 * Der **Betrachtungsbereich-Chip** im Kopf jeder Datensicht.
 *
 * Bindet die persönliche Bereichs-Auswahl an den geteilten
 * [BereichAuswahlChip](./BereichAuswahlChip.tsx); dort steht die Darstellung,
 * hier nur, *welche* Auswahl gemeint ist und was sie bewirkt.
 *
 * Der Chip erscheint in allen Build-Varianten — auch dort, wo der
 * Status-Katalog nicht lädt und der Standard-Bereich aus dem Code kommt.
 */
import { useBereich } from '@/core/hooks/useBereich';
import { BereichAuswahlChip } from './BereichAuswahlChip';

/** Was der Bereich schneidet — und was ausdrücklich nicht (Pitfall #46). */
export const BEREICH_EINLEITUNG = (
  <>
    Der Bereich bestimmt den <strong>Arbeitsvorrat</strong>: Listen, Zähler, Fristen und
    Auslastung. Die <strong>Suche bleibt am Vollbestand</strong>, und ein Antrag lässt sich
    immer direkt öffnen — auch außerhalb des Bereichs.
  </>
);

export function BereichChip({ ausgeblendet }: {
  /** Wie viele Datensätze der Bereich gerade wegnimmt (siehe Basis-Chip). */
  ausgeblendet?: number;
}): React.ReactElement {
  const bereich = useBereich();
  return (
    <BereichAuswahlChip
      bereich={bereich}
      ausgeblendet={ausgeblendet}
      einleitung={BEREICH_EINLEITUNG}
      grundModus="standard"
    />
  );
}
