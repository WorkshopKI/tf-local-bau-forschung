/**
 * Kein-Treffer-Auswege — geprüfte Vorschläge statt einer Sackgasse.
 *
 * Der bisherige Null-Treffer-Zustand war eine einzige Zeile: „Keine Ergebnisse
 * für …". Kein Hinweis, warum, kein Weg weiter. Das ist der schwächste Zustand
 * der Seite und der einzige, in dem der Nutzer garantiert Hilfe braucht.
 *
 * **Vorgeschlagen wird nur, was nachweislich Treffer bringt.** Jeder Ausweg
 * wird vor der Anzeige einmal durchgerechnet und trägt seine echte Trefferzahl.
 * Ein Vorschlag, der ins Leere führt, wäre schlimmer als kein Vorschlag.
 *
 * Nur die WORTLAUT-Stufe wird probeweise gefahren: sie ist synchron und
 * kostet ~10–30 ms. Orama blockiert 150–300 ms je Lauf, und jede veränderte
 * Anfrage bräuchte für die Vektorstufe ein neues Embedding — mehrere Probeläufe
 * darüber wären sekundenlang spürbar.
 *
 * Rein — der Aufrufer reicht die Suchfunktion herein, damit dieses Modul ohne
 * Korpus und ohne IDB testbar bleibt.
 */
import type { SuchVerknuepfung } from '@/core/hooks/useSuchVerknuepfung';
import type { Suchbereich } from '@/core/services/search/suchbereich';

export interface AuswegLage {
  query: string;
  verknuepfung: SuchVerknuepfung;
  stammSuche: boolean;
  bereich: Suchbereich;
  /** Beschriftungen der gesetzten Facettenfilter, z. B. „Jahr: 2013". */
  aktiveFilter: readonly string[];
}

/** Was ein Ausweg ändert. Der Aufrufer wendet genau das an, was hier steht —
 *  kein zweiter Ort, an dem die Wirkung noch einmal formuliert wird. */
export interface AuswegAenderung {
  query?: string;
  verknuepfung?: SuchVerknuepfung;
  stammSuche?: boolean;
  bereich?: Suchbereich;
  /** Alle Facettenfilter zurücknehmen. */
  filterLeeren?: boolean;
}

export interface Ausweg {
  id: string;
  text: string;
  aenderung: AuswegAenderung;
  treffer: number;
}

/** Führt eine Probesuche aus und liefert nur die Trefferzahl. */
export type Probelauf = (
  query: string,
  optionen: { verknuepfung: SuchVerknuepfung; stammSuche: boolean; bereich: Suchbereich },
) => number;

/** Wie viele Auswege höchstens angeboten werden. Mehr liest niemand. */
const MAX_AUSWEGE = 4;

/**
 * Berechnet die Auswege für eine ergebnislose Suche.
 *
 * Reihenfolge der Kandidaten ist Absicht: erst die kleinsten Eingriffe (einen
 * Filter lösen, ein Wort weglassen), dann die größeren (Verknüpfung lockern,
 * Wortstämme zulassen), zuletzt die Kombination. Wer zuerst das Naheliegende
 * angeboten bekommt, versteht auch, was schiefging.
 */
export function berechneAuswege(lage: AuswegLage, probe: Probelauf): Ausweg[] {
  const woerter = lage.query.trim().split(/\s+/).filter(w => w.length > 0);
  const basis = {
    verknuepfung: lage.verknuepfung,
    stammSuche: lage.stammSuche,
    bereich: lage.bereich,
  };
  const kandidaten: Array<{ id: string; text: string; aenderung: AuswegAenderung }> = [];

  // 1. Gesetzte Filter lösen — der häufigste Grund für plötzlich null Treffer.
  if (lage.aktiveFilter.length > 0) {
    kandidaten.push({
      id: 'filter',
      text: lage.aktiveFilter.length === 1
        ? `Filter „${lage.aktiveFilter[0]}" entfernen`
        : `${lage.aktiveFilter.length} Filter entfernen`,
      aenderung: { filterLeeren: true },
    });
  }

  // 2. Je ein Wort weglassen — nur sinnvoll ab zwei Wörtern.
  if (woerter.length > 1) {
    for (const weg of woerter) {
      kandidaten.push({
        id: `ohne:${weg}`,
        text: `Wort „${weg}" weglassen`,
        aenderung: { query: woerter.filter(w => w !== weg).join(' ') },
      });
    }
  }

  // 3. Verknüpfung lockern.
  if (lage.verknuepfung === 'wortfolge') {
    kandidaten.push({
      id: 'und',
      text: 'nicht als Wortfolge, sondern alle Wörter suchen',
      aenderung: { verknuepfung: 'und' },
    });
  }
  if (lage.verknuepfung !== 'oder' && woerter.length > 1) {
    kandidaten.push({
      id: 'oder',
      text: 'irgendeines der Wörter genügen lassen',
      aenderung: { verknuepfung: 'oder' },
    });
  }

  // 4. Wortstämme zulassen.
  if (!lage.stammSuche) {
    kandidaten.push({
      id: 'stamm',
      text: 'ähnliche Begriffe mitsuchen (Wortstamm)',
      aenderung: { stammSuche: true },
    });
  }

  // 5. Den Suchbereich öffnen.
  if (lage.bereich !== 'alles') {
    kandidaten.push({
      id: 'bereich',
      text: 'in allen Feldern suchen',
      aenderung: { bereich: 'alles' },
    });
  }

  const geprueft: Ausweg[] = [];
  for (const k of kandidaten) {
    const treffer = probe(k.aenderung.query ?? lage.query, { ...basis, ...k.aenderung });
    if (treffer > 0) geprueft.push({ ...k, treffer });
    if (geprueft.length >= MAX_AUSWEGE) break;
  }

  // 6. Hilft nichts einzeln, wird alles zusammen angeboten. Ein Vorschlag, der
  //    nur in Kombination trägt, ist immer noch besser als eine Sackgasse.
  if (geprueft.length === 0 && kandidaten.length > 0) {
    const zusammen: AuswegAenderung = {};
    for (const k of kandidaten) Object.assign(zusammen, k.aenderung);
    // Beim Zusammenlegen gewinnt die weiteste Fassung: die Anfrage bleibt ganz,
    // gelockert wird über die Optionen.
    delete zusammen.query;
    const treffer = probe(lage.query, { ...basis, ...zusammen });
    if (treffer > 0) {
      geprueft.push({
        id: 'kombiniert',
        text: 'alle Anpassungen zusammen anwenden',
        aenderung: zusammen,
        treffer,
      });
    }
  }

  return geprueft;
}
