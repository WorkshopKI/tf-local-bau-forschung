/**
 * Der Zustand hinter der Vorschlagsliste des Frage-Modus: offen/zu, Auswahlmarke,
 * Tastatur — und der Sprung in die nächste Lücke einer Vorlage.
 *
 * **Die Eingabetaste hat hier drei Bedeutungen**, und die Reihenfolge ist die
 * ganze Logik:
 *
 *  1. Steht eine Zeile der Liste unter der Marke → diese Zeile wählen.
 *  2. Sonst, wenn die Frage noch eine Lücke `‹…›` hat → in die Lücke springen,
 *     statt sie an die KI zu schicken. Ein Modell, das „‹Kürzel›" liest, denkt
 *     sich einen Bearbeiter aus oder verwirft die halbe Frage — beides teurer
 *     als ein Sprung.
 *  3. Sonst → die Frage stellen.
 *
 * Das Markieren geschieht in einem Layout-Effekt und nicht direkt im Ereignis:
 * das Eingabefeld ist kontrolliert, sein Text steht erst nach dem Rendern im
 * DOM, und `setSelectionRange` auf dem alten Text markierte die falsche Stelle.
 */
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  baueFrageAbschnitte, ersteLuecke, flacheListe,
  type FrageAbschnitt, type FrageVorschlag,
} from './vorschlagsAbschnitte';
import { useFrageVerlauf } from './frageVerlauf';

/**
 * Das Suchfeld ist je nach Modus ein `<input>` oder ein `<textarea>`
 * ([SuchFeld.tsx](../SuchFeld.tsx)). Beide können, was hier gebraucht wird:
 * Fokus setzen und einen Bereich markieren.
 */
export type SuchFeldElement = HTMLInputElement | HTMLTextAreaElement;

/** Was unter dem Feld steht, wenn die Eingabetaste auf eine Lücke trifft. */
export const LUECKEN_HINWEIS =
  'Noch auszufüllen — die markierte Lücke überschreiben, Enter springt zur nächsten.';

export interface FrageVorschlaegeSteuerung {
  offen: boolean;
  abschnitte: readonly FrageAbschnitt[];
  /** Laufende Nummer über ALLE Abschnitte; -1 = keine Zeile markiert. */
  aktiv: number;
  /** Hinweis zur Lücke, sonst `null`. */
  hinweis: string | null;
  setAktiv: (i: number) => void;
  waehle: (v: FrageVorschlag) => void;
  entferne: (frage: string) => void;
  leere: () => void;
  /** An `onFocus` des Feldes. */
  beiFokus: () => void;
  /** An `onBlur` des Feldes. */
  beiVerlust: () => void;
  /** Nach dem `setSearch` in `onChange` aufzurufen. */
  beiEingabe: () => void;
  /** An `onKeyDown` des Feldes — behandelt ↑ ↓ ⏎ und Esc. */
  beiTaste: (e: React.KeyboardEvent<SuchFeldElement>) => void;
  /**
   * Was die Eingabetaste ohne markierte Zeile tut: in die nächste Lücke
   * springen, sonst fragen. Der Knopf „Frage stellen" ruft dasselbe — zwei Wege
   * zur selben Geste dürfen sich nicht verschieden verhalten.
   */
  absenden: () => void;
}

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
  const { feldRef, text, setText, stelleFrage, aktiviert } = opt;
  const verlauf = useFrageVerlauf(s => s.verlauf);
  const entferne = useFrageVerlauf(s => s.entferne);
  const leere = useFrageVerlauf(s => s.leere);

  const [offenRoh, setOffen] = useState(false);
  const [aktivRoh, setAktivRoh] = useState(-1);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [markierung, setMarkierung] = useState<{ start: number; ende: number } | null>(null);

  const abschnitte = useMemo(
    () => (aktiviert ? baueFrageAbschnitte(text, verlauf) : []),
    [aktiviert, text, verlauf],
  );
  const flach = useMemo(() => flacheListe(abschnitte), [abschnitte]);

  const offen = offenRoh && aktiviert && flach.length > 0;
  // Die Marke kann eine Zeile überleben, die es nach dem Tippen nicht mehr gibt.
  const aktiv = aktivRoh < flach.length ? aktivRoh : -1;

  // Markieren, sobald der neue Text im DOM steht (siehe Kopfkommentar).
  useLayoutEffect(() => {
    if (!markierung) return;
    const el = feldRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(markierung.start, markierung.ende);
    }
    setMarkierung(null);
  }, [markierung, feldRef]);

  /** Springt in die erste offene Lücke. `false` = es gab keine. */
  const springeInLuecke = useCallback((wert: string): boolean => {
    const l = ersteLuecke(wert);
    if (!l) return false;
    setMarkierung(l);
    setHinweis(LUECKEN_HINWEIS);
    return true;
  }, []);

  const waehle = useCallback((v: FrageVorschlag): void => {
    setText(v.text);
    setOffen(false);
    setAktivRoh(-1);
    if (v.fertig) {
      setHinweis(null);
      stelleFrage(v.text);
      return;
    }
    // Eine Vorlage ist ein halber Satz — sie wird eingesetzt, nicht abgeschickt.
    springeInLuecke(v.text);
  }, [setText, stelleFrage, springeInLuecke]);

  const absenden = useCallback((): void => {
    setOffen(false);
    if (springeInLuecke(text)) return;
    setHinweis(null);
    stelleFrage(text);
  }, [springeInLuecke, text, stelleFrage]);

  const beiTaste = useCallback((e: React.KeyboardEvent<SuchFeldElement>): void => {
    if (!aktiviert) return;
    if (e.key === 'ArrowDown' && flach.length > 0) {
      e.preventDefault();
      setOffen(true);
      setAktivRoh(i => (i + 1) % flach.length);
      return;
    }
    if (e.key === 'ArrowUp' && flach.length > 0) {
      e.preventDefault();
      setOffen(true);
      setAktivRoh(i => (i <= 0 ? flach.length - 1 : i - 1));
      return;
    }
    if (e.key === 'Escape') {
      setOffen(false);
      setAktivRoh(-1);
      return;
    }
    if (e.key !== 'Enter') return;

    e.preventDefault();
    const markiert = offen && aktiv >= 0 ? flach[aktiv] : undefined;
    if (markiert) {
      waehle(markiert);
      return;
    }
    absenden();
  }, [aktiviert, flach, offen, aktiv, waehle, absenden]);

  const beiFokus = useCallback((): void => { setOffen(true); }, []);
  const beiVerlust = useCallback((): void => { setOffen(false); setAktivRoh(-1); }, []);
  const beiEingabe = useCallback((): void => {
    setOffen(true);
    setAktivRoh(-1);
    setHinweis(null);
  }, []);

  return {
    offen, abschnitte, aktiv, hinweis,
    setAktiv: setAktivRoh, waehle, entferne, leere,
    beiFokus, beiVerlust, beiEingabe, beiTaste, absenden,
  };
}
