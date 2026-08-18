/**
 * Startet den Antwort-Lauf, sobald zu einer gestellten Frage Treffer vorliegen.
 *
 * **Genau ein Lauf je (Frage, Trefferstand).** Der Schlüssel ist die Frage plus
 * die Trefferzahl; ein zweiter Lauf für dieselbe Frage wäre Wartezeit für
 * dasselbe Ergebnis. Weil die Trefferliste beim Abwählen eines Begriffs
 * schrumpft, gehört die Zahl in den Schlüssel: das ist eine ANDERE Frage an den
 * Bestand, auch wenn der Satz derselbe ist.
 *
 * **Der Lauf bricht ab, wenn die Frage wechselt.** Sonst schriebe die Antwort
 * auf eine verlassene Frage in die Karte der nächsten.
 */
import { useEffect, useRef, useState } from 'react';
import type { AIBridge } from '@/core/services/ai/bridge';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import type { Frageplan } from '@/core/services/search/frageplan';
import { ermittleFrageantwort } from '@/core/services/search/frageantwort-lauf';
import { baueBefund, befundAlsText } from '../frageBefund';
import {
  baueAehnlichkeitsBlock, baueKontextBlock, teileNachFundstelle, waehleKontextTreffer,
} from '../assistentKontext';

/**
 * Wie viele Treffer als Belege im Volltext mitfahren.
 *
 * Seit v4.104 vierzig statt zwanzig — dieselbe Zahl wie im Chat-Kontext. Die
 * Halbierung war eine Platz-Vorsicht, und die ist am echten Bestand gemessen
 * unbegründet: eine Belegzeile kostet im Mittel **355 Zeichen** (12 180
 * Anträge; Median 363, p90 457, längste 609). Vierzig Belege sind damit rund
 * **14 200 Zeichen** statt 7 100 — gut 4 000 Token, in jedem Fall unter dem
 * Deckel von `KONTEXT_CHAR_BUDGET` (24 000), der ohnehin darüber wacht.
 *
 * Der Befund daneben bleibt die Aussage über die MENGE; die Belege sind das,
 * woran die Antwort einzelne Vorhaben festmacht. Vierzig davon machen aus einer
 * Frage nach einer Liste eine Antwort mit Beispielen statt mit Stichproben.
 */
export const BELEG_TREFFER = 40;

/**
 * Wie viele Vorschläge der Ähnlichkeitssuche als ZWEITE Menge mitfahren.
 *
 * Zwölf, nicht die bis zu 50, die die Stufe liefert: sie sind nach Kosinus
 * sortiert, das Gute steht vorn, und jede Zeile kostet dieselben ~355 Zeichen
 * wie ein Beleg. Zwölf sind rund 4 300 Zeichen — der Preis dafür, dass das
 * Modell überhaupt entscheiden KANN, statt dass eine Schwelle es tut.
 */
export const AEHNLICH_TREFFER = 12;

export interface FrageAntwortStand {
  laeuft: boolean;
  antwort: string | null;
  fehler: string | null;
  /** Wie viele Treffer der Befund umfasste. */
  gesamt: number;
}

const LEER: FrageAntwortStand = { laeuft: false, antwort: null, fehler: null, gesamt: 0 };

export function useFrageAntwort(
  bridge: AIBridge,
  plan: Frageplan | null,
  treffer: readonly UnifiedSearchResult[],
  /** `false`, solange die Suche noch läuft — dann ist die Menge nicht fertig. */
  bereit: boolean,
): FrageAntwortStand {
  const [stand, setStand] = useState<FrageAntwortStand>(LEER);
  const gelaufen = useRef<string | null>(null);

  useEffect(() => {
    if (!plan || !bereit || treffer.length === 0) {
      // Ohne Plan gibt es nichts zu beantworten — und die Karte darf dann auch
      // keine Antwort von vorhin stehen lassen.
      if (!plan) { gelaufen.current = null; setStand(LEER); }
      return;
    }
    const schluessel = `${plan.frage} :: ${treffer.length}`;
    if (gelaufen.current === schluessel) return;
    gelaufen.current = schluessel;

    const abbruch = new AbortController();
    setStand({ laeuft: true, antwort: null, fehler: null, gesamt: treffer.length });

    void (async () => {
      const befund = baueBefund(treffer, plan);
      // Zwei Mengen, zwei Blöcke: Belege sind belegt (ein gesuchtes Wort steht
      // drin), Kandidaten sind Vorschläge des Embeddings. Untergemischt wären
      // sie ununterscheidbar — und das Modell zitierte eine Vermutung wie einen
      // Fund. Getrennt kann es entscheiden, und es muss die Entscheidung
      // kennzeichnen (siehe `baueAntwortPrompt`).
      const { wortlaut, aehnlich } = teileNachFundstelle(treffer);
      // Die Zahl der gefragten Sachen kommt aus DEM Befund, der gleich daneben
      // gezählt wird: dieselbe Gruppe darf nicht zweimal verschieden bestimmt
      // werden — der Befund zählt sie, die Belegzeile beschriftet sie.
      const themen = befund.themen.length;
      const belege = baueKontextBlock(
        waehleKontextTreffer(wortlaut, BELEG_TREFFER, undefined, themen), wortlaut.length, themen,
      );
      const kandidaten = baueAehnlichkeitsBlock(
        waehleKontextTreffer(aehnlich, AEHNLICH_TREFFER), aehnlich.length,
      );
      const res = await ermittleFrageantwort(
        bridge, plan.frage, befundAlsText(befund), belege, kandidaten, abbruch.signal,
      );
      if (abbruch.signal.aborted) return;
      setStand(res.ok
        ? { laeuft: false, antwort: res.antwort, fehler: null, gesamt: treffer.length }
        : { laeuft: false, antwort: null, fehler: res.fehler, gesamt: treffer.length });
    })();

    return () => abbruch.abort();
  }, [bridge, plan, treffer, bereit]);

  return stand;
}
