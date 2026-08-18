/**
 * Die Brücke zwischen der Antwortkarte und der Trefferliste darunter.
 *
 * Beide stammen aus DEMSELBEN Lauf, standen aber bis v4.100 unverbunden
 * nebeneinander: ein Klick auf ein Kennzeichen in der Antwort verließ die Suche
 * und öffnete die Antragsseite — obwohl derselbe Antrag zwei Zeilen tiefer schon
 * in der Liste stand. Gemeldet als „wie kann der User die Liste der KI ganz oben
 * mit den Suchergebnissen darunter zusammenbringen?".
 *
 * Der Hook hält die drei Stücke zusammen, die diese Verbindung braucht:
 *
 *  1. **die Belege** — was die Antwort über ein einzelnes Vorhaben sagt,
 *     aus ihrem Text abgetrennt ([genannteTreffer.ts](./genannteTreffer.ts));
 *  2. **den Filter** „nur die genannten" samt seiner Zahl;
 *  3. **den Sprung** zu einer Zeile, mit dem Rückweg auf die Antragsseite für
 *     den Fall, dass das genannte Vorhaben gar nicht in der Liste steht.
 *
 * **Die zwei Mengen sind Absicht, kein Versehen.** `useFrageAntwort` läuft
 * weiter auf der UNGEFILTERTEN Menge; der Lauf ist auf `frage :: trefferzahl`
 * gekeyt. Liefe er auf `angezeigt`, änderte das Einschalten des Chips die
 * Trefferzahl, stieße einen neuen Lauf an, der eine andere Menge Vorhaben
 * nennt, die den Chip wieder anders filtert — eine Rückkopplung, die bei jedem
 * Klick ein anderes Ergebnis liefert.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { zerlegeAntwort, type AntwortBeleg } from './genannteTreffer';

export interface AntwortBruecke {
  /** Was die Antwort je Kennzeichen sagt — leer, solange keine Antwort steht. */
  belege: ReadonlyMap<string, AntwortBeleg>;
  /** Die Menge, die Liste, Tabelle, Kopfzahl und Export zeigen. */
  angezeigt: readonly UnifiedSearchResult[];
  /** Wie viele der Treffer die Antwort nennt. 0 = kein Chip. */
  genannteAnzahl: number;
  nurGenannte: boolean;
  schalteNurGenannte: () => void;
  /** Was die Liste als Sprungziel bekommt. Der Zähler sorgt dafür, dass
   *  ZWEIMAL dasselbe Kennzeichen auch zweimal springt. */
  sprung: { fkz: string; n: number } | null;
  springeZuFkz: (fkz: string) => void;
}

export function useAntwortBruecke({
  treffer,
  antwort,
  aufAntragsseite,
  wechsleZurListe,
}: {
  /** Die ungefilterte Ergebnismenge — dieselbe, die den Antwort-Lauf speist. */
  treffer: readonly UnifiedSearchResult[];
  antwort: string | null;
  /** Rückweg für ein genanntes Vorhaben, das nicht in der Liste steht. */
  aufAntragsseite: (fkz: string) => void;
  /** Der Sprung wirkt in der Liste; aus der Tabelle wird dorthin gewechselt. */
  wechsleZurListe: () => void;
}): AntwortBruecke {
  const belege = useMemo(() => zerlegeAntwort(antwort), [antwort]);
  const [nurGenannte, setNurGenannte] = useState(false);
  const [sprung, setSprung] = useState<{ fkz: string; n: number } | null>(null);

  const genannt = useCallback(
    (t: UnifiedSearchResult) => t.fkz !== undefined && belege.has(t.fkz),
    [belege],
  );

  const genannteAnzahl = useMemo(
    () => treffer.filter(genannt).length,
    [treffer, genannt],
  );

  // Eine neue Antwort meint eine andere Menge — ein Filter, der die alte
  // überlebte, wäre ein Zustand ohne sichtbaren Grund.
  useEffect(() => { setNurGenannte(false); }, [belege]);

  const angezeigt = useMemo(
    () => (nurGenannte ? treffer.filter(genannt) : treffer),
    [nurGenannte, treffer, genannt],
  );

  const springeZuFkz = useCallback((fkz: string): void => {
    if (!treffer.some(t => t.fkz === fkz)) {
      // Genannt, aber nicht in der Liste — etwa weil eine Facette ihn seither
      // wegnimmt. Dann bleibt der alte Weg: die Antragsseite. Den Klick stumm
      // verpuffen zu lassen wäre die schlechtere Antwort.
      aufAntragsseite(fkz);
      return;
    }
    wechsleZurListe();
    setSprung(s => ({ fkz, n: (s?.n ?? 0) + 1 }));
  }, [treffer, aufAntragsseite, wechsleZurListe]);

  return {
    belege,
    angezeigt,
    genannteAnzahl,
    nurGenannte,
    schalteNurGenannte: useCallback(() => setNurGenannte(v => !v), []),
    sprung,
    springeZuFkz,
  };
}
