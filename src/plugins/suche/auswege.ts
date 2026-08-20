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
  /** Die gewählten Richtlinien; `null` = alle. Eigene Zeile, weil sie sich
   *  eigens zurücknehmen lässt: sie überlebt die Anfrage, die Facetten nicht. */
  richtlinien: ReadonlySet<string> | null;
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
  /** Die Richtlinien-Einschränkung aufheben (zurück auf „alle"). */
  richtlinienOeffnen?: boolean;
}

export interface Ausweg {
  id: string;
  text: string;
  aenderung: AuswegAenderung;
  treffer: number;
}

/**
 * Trennt den einen Ausweg ab, der über der Liste steht, von denen, die in ihr
 * bleiben ([KeinTrefferZustand.tsx](./KeinTrefferZustand.tsx)).
 *
 * **Herausgehoben wird nur das Öffnen der Richtlinien.** Es ist der einzige
 * Grund für null Treffer, bei dem die gesuchten Anträge nachweislich da sind —
 * gefunden, dann von einer Einstellung weggeblendet, die die Anfrage überlebt
 * und genau deshalb vergessen wird. Alle anderen Auswege ändern die Anfrage
 * oder die Regler dieser einen Suche; was sie ändern, steht sichtbar über der
 * Trefferliste.
 *
 * Erkannt an der WIRKUNG, nicht an der Id: `aenderung` ist die eine Stelle, an
 * der steht, was ein Ausweg tut. Ein Vergleich auf die Id wäre eine zweite
 * Definition derselben Sache.
 *
 * **Und nur, wenn er NICHTS SONST tut**: der zusammengelegte Ausweg (unten,
 * wenn einzeln nichts trägt) führt `richtlinienOeffnen` mit, leert aber
 * zusätzlich Filter und lockert Regler. Als Knopf „Alle Richtlinien
 * einbeziehen" wäre er eine Beschriftung, die ihre Wirkung verschweigt — er
 * bleibt in der Liste, wo sein eigener Text steht.
 */
export function teileAuswege(
  auswege: readonly Ausweg[],
): { versteckt: Ausweg | null; rest: readonly Ausweg[] } {
  const versteckt = auswege.find(
    a => a.aenderung.richtlinienOeffnen === true && Object.keys(a.aenderung).length === 1,
  ) ?? null;
  return {
    versteckt,
    rest: versteckt === null ? auswege : auswege.filter(a => a !== versteckt),
  };
}

/** Führt eine Probesuche aus und liefert nur die Trefferzahl. */
export type Probelauf = (
  query: string,
  optionen: {
    verknuepfung: SuchVerknuepfung;
    stammSuche: boolean;
    bereich: Suchbereich;
    richtlinien: ReadonlySet<string> | null;
  },
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
    richtlinien: lage.richtlinien,
  };
  /** Was der Probelauf sehen soll. `richtlinienOeffnen` ist kein Regler,
   *  sondern hebt einen auf — deshalb hier übersetzt statt hineingespreizt. */
  const optionen = (a: AuswegAenderung): Parameters<Probelauf>[1] => ({
    verknuepfung: a.verknuepfung ?? basis.verknuepfung,
    stammSuche: a.stammSuche ?? basis.stammSuche,
    bereich: a.bereich ?? basis.bereich,
    richtlinien: a.richtlinienOeffnen ? null : basis.richtlinien,
  });
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

  // 1b. Die Richtlinien öffnen. Steht neben dem Filter, nicht in ihm: die
  //     Auswahl gilt bis auf Widerruf, ein Facettenfilter nur für diese
  //     Anfrage — wer beides mit einem Klick verlöre, verlöre eine
  //     Einstellung, die er einmal bewusst gesetzt hat.
  if (lage.richtlinien !== null) {
    kandidaten.push({
      id: 'richtlinien',
      text: 'alle Richtlinien einbeziehen',
      aenderung: { richtlinienOeffnen: true },
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
      text: 'auch andere Wortformen (gleiches Wort, andere Form)',
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
    const treffer = probe(k.aenderung.query ?? lage.query, optionen(k.aenderung));
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
    const treffer = probe(lage.query, optionen(zusammen));
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
