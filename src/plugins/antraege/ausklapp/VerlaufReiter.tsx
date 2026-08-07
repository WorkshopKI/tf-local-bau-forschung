/**
 * Der Verlauf einer Zeile — Bahn oben, Klartext darunter.
 *
 * **Die Liste ist nicht ersetzt worden, sie ist eine Stufe tiefer gerückt.** Bis
 * v3.25 stand hier ausschließlich die Aufzählung aller Spuren; sie war das
 * Sicherheitsnetz, solange die Bauform der Bahn noch offen war. Seit v3.26
 * zeichnet das {@link VerlaufsBand} sie, und ein Klick auf eine Bahn klappt
 * darunter genau diese Spur im Klartext auf ({@link SpurListe}). Eine Grafik
 * kann Zahlen unterschlagen; ein Listeneintrag nicht.
 *
 * **Nie eine leere Zeile.** Jeder Spurzustand ≠ `verlauf` trägt eine Begründung
 * im Klartext — „kein Bearbeitungsstand", „kein Wert im Export" und „kein
 * Übergang erklärt ihn" sind drei verschiedene Auskünfte, und keine davon ist
 * Schweigen (Pitfall #44, Abschnitt 14.2).
 */
import type { VerlaufsSpur } from '@/core/status/verlauf';
import { VerlaufsBand } from '../verlauf-band/VerlaufsBand';
import { JournalFuss, leise } from './SpurListe';

export function VerlaufReiter({
  spuren, eigenes, journalAb, journalGenutzt, laden, bezugsZeitpunkt, fassung,
}: {
  spuren: readonly VerlaufsSpur[];
  /** Aktenzeichen der geklickten Zeile — ihre Spur wird benannt. */
  eigenes: string;
  journalAb: string | null;
  journalGenutzt: boolean;
  laden: boolean;
  /** Rechtes Ende der Achse. */
  bezugsZeitpunkt: string;
  /** Beschriftung der geladenen Katalogfassung — für den kopierten Text. */
  fassung: string | null;
}): React.ReactElement {
  if (laden) return <p className={leise}>Lädt …</p>;
  if (spuren.length === 0) {
    return <p className={leise}>Kein Statuskatalog geladen — ohne ihn gibt es keine Bahn.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <VerlaufsBand
        spuren={spuren} eigenes={eigenes} bezugsZeitpunkt={bezugsZeitpunkt}
        fassung={fassung} journalAb={journalAb}
      />
      <JournalFuss journalAb={journalAb} journalGenutzt={journalGenutzt} />
    </div>
  );
}
