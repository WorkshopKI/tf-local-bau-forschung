/**
 * Der Frage-Modus der Förderantrags-Liste an der geteilten Vorschlags-Mechanik
 * ([@/components/frage-vorschlaege](src/components/frage-vorschlaege/useFrageVorschlaege.ts)).
 *
 * Diese Datei bindet nur die zwei Dinge an, die der Seite gehören: ihren
 * Katalog ([vorschlagsAbschnitte.ts](./vorschlagsAbschnitte.ts)) und ihren
 * **gerätelokalen** Frage-Verlauf ([frageVerlauf.ts](./frageVerlauf.ts)) — der
 * ist bewusst getrennt vom Verlauf der Dokumenten-Suche, weil eine Frage an die
 * Antragsliste dort nichts fände.
 *
 * Alles Verhalten (die drei Bedeutungen der Eingabetaste, der Sprung in die
 * Lücke, die Auswahlmarke) steht im geteilten Hook und nicht hier — zwei
 * Kopien davon liefen unweigerlich auseinander.
 */
import { useMemo } from 'react';
import {
  useFrageVorschlaege as useGeteilteVorschlaege,
  type FrageVorschlaegeSteuerung, type SuchFeldElement,
} from '@/components/frage-vorschlaege';
import { ANTRAGS_FRAGE_KATALOG } from './vorschlagsAbschnitte';
import { useFrageVerlauf } from './frageVerlauf';

export { LUECKEN_HINWEIS } from '@/components/frage-vorschlaege';
export type { FrageVorschlaegeSteuerung, SuchFeldElement };

export interface FrageVorschlaegeOptionen {
  /** Das Eingabefeld — für das Markieren der Lücke. */
  feldRef: React.RefObject<SuchFeldElement | null>;
  /** Der aktuelle Feldtext. */
  text: string;
  setText: (t: string) => void;
  /** Der Lauf, den eine fertige Frage auslöst. */
  stelleFrage: (frage: string) => void;
  /** `false` = Stichwort-Modus: die Liste bleibt zu, die Tasten unberührt. */
  aktiviert: boolean;
}

export function useFrageVorschlaege(opt: FrageVorschlaegeOptionen): FrageVorschlaegeSteuerung {
  const verlauf = useFrageVerlauf(s => s.verlauf);
  const entferne = useFrageVerlauf(s => s.entferne);
  const leere = useFrageVerlauf(s => s.leere);
  // Der Katalog steht im Dep-Array des geteilten Hooks; als Modul-Konstante ist
  // er ohnehin stabil, das `useMemo` hält die Zusage sichtbar.
  const katalog = useMemo(() => ANTRAGS_FRAGE_KATALOG, []);

  return useGeteilteVorschlaege({
    ...opt,
    katalog,
    verlauf,
    entferneAusVerlauf: entferne,
    leereVerlauf: leere,
  });
}
