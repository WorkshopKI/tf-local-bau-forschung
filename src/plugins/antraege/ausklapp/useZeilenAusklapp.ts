/**
 * Hält den aufgeklappten Bereich — und macht ihn wieder zu, sobald sich die
 * Liste unter ihm ändert.
 *
 * **Warum das Schließen der eigentliche Punkt ist.** Der Bereich hängt an einem
 * Zeilenschlüssel, nicht an einer Bildschirmposition. Wechselt Sortierung,
 * Filter, Gruppierung, Körnung, Sicht oder Betrachtungsbereich, steht die Zeile
 * woanders oder gar nicht mehr da — der Bereich klebte dann unter einem fremden
 * Vorgang oder verschwände kommentarlos. Beides ist schlechter als „zu".
 *
 * Keine Persistenz (kein `localStorage`, kein Store): ein aufgeklappter Bereich
 * ist eine Nachfrage im Moment, kein Zustand des Vorgangs.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  naechsterZustand, istOffen as istOffenPur,
  type AusklappZustand, type ReiterId,
} from './ausklappZustand';

export interface ZeilenAusklapp {
  offen: AusklappZustand | null;
  istOffen: (key: string) => boolean;
  reiterVon: (key: string) => ReiterId | null;
  umschalten: (key: string, reiter: ReiterId) => void;
  /** Öffnet, ohne je zu schließen — für Verweise von außen („Ganzen Verlauf
   *  zeigen" im Popover). Ein Verweis, der bei offenem Bereich zuklappt, ist
   *  ein Rätsel, kein Sprungziel. */
  oeffne: (key: string, reiter: ReiterId) => void;
  /** Reiter wechseln, ohne den Bereich zu schließen (Klick in der Reiterleiste). */
  setzeReiter: (reiter: ReiterId) => void;
  schliessen: () => void;
}

/**
 * @param signatur Alles, dessen Wechsel den Bereich schließen muss, zu EINER
 *   Zeichenkette gefaltet. Der Aufrufer baut sie — er weiß, welche Steuerungen
 *   seine Liste hat; dieser Hook rät nicht.
 */
export function useZeilenAusklapp(signatur: string): ZeilenAusklapp {
  const [offen, setOffen] = useState<AusklappZustand | null>(null);

  useEffect(() => { setOffen(null); }, [signatur]);

  const umschalten = useCallback((key: string, reiter: ReiterId) => {
    setOffen(a => naechsterZustand(a, key, reiter));
  }, []);

  const oeffne = useCallback((key: string, reiter: ReiterId) => {
    setOffen({ key, reiter });
  }, []);

  const setzeReiter = useCallback((reiter: ReiterId) => {
    setOffen(a => (a === null ? null : { ...a, reiter }));
  }, []);

  const schliessen = useCallback(() => { setOffen(null); }, []);

  return {
    offen,
    istOffen: useCallback((key: string) => istOffenPur(offen, key), [offen]),
    reiterVon: useCallback(
      (key: string) => (offen !== null && offen.key === key ? offen.reiter : null),
      [offen],
    ),
    umschalten,
    oeffne,
    setzeReiter,
    schliessen,
  };
}
