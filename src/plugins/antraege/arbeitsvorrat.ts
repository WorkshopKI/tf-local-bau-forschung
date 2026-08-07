/**
 * Arbeitsvorrat/Beendet-Split für den „Alle"-Tab (Journey-Paket 2 Phase 5).
 *
 * Der „Alle"-Tab mischt aktive Anträge mit längst abgeschlossenen — der
 * Arbeitsvorrat (nicht-terminal) verschwindet im Archiv-Rauschen. Diese
 * pure Schicht teilt die gefilterte Liste in zwei kontiguierliche Sektionen:
 * **Arbeitsvorrat** (nicht-terminal, oben) und **Beendet** (terminal, unten,
 * default ausgeblendet).
 *
 * **Eigene Achse seit v3.5** — bis dahin hing der Split an „Gruppierung: Keine".
 * Das war eine stille Kopplung: wer nach etwas gruppierte, verlor die Trennung,
 * und als die Verbund-Verdichtung aus der Gruppierung heraus auf die
 * Ansicht-Achse wanderte (v3.4), tauchte der Split bei allen auf, die vorher
 * „Gruppierung: Verbund" stehen hatten. Ob beendete Anträge in der Liste stehen,
 * ist eine EIGENE Frage — sie hat jetzt einen eigenen Schalter („Beendet:
 * ausgeblendet | eingeblendet") und ist von Ansicht und Gruppierung unabhängig.
 *
 * Beide Namen sind **Aggregatnamen** und kommen mit keiner Kategoriebezeichnung
 * überein (v2.409). Vorher hießen sie „In Arbeit" und „Abgeschlossen" — das
 * erste kollidiert seit der Umbenennung wortgleich mit der Kategorie
 * `in_pruefung`, und ein Abschnitt, der sieben Kategorien meint und heißt wie
 * eine davon, ist genau die Verwechslung, die A3 beseitigt hat. „Beendet" ist
 * dieselbe Menge wie der gleichnamige Bucket der Status-Pille, also derselbe
 * Name.
 *
 * Einzelquelle der Terminalität ist `isTerminalStatus` (Kategorie
 * `abgeschlossen` ∪ `abgelehnt`, bewusst OHNE `bewilligt` — nach der
 * Bewilligung folgt noch die Begleitphase, der Antrag bleibt „in Arbeit").
 *
 * Nur Logik, kein React — die Renderer (Tabelle/Liste) und der einklappbare
 * Header konsumieren die Helfer.
 */
import type { AntragListItem } from '@/core/services/csv/types';
import {
  isTerminalStatus,
  isAbgelehntZurueckgezogenStatus,
  ABGELEHNT_ZURUECKGEZOGEN,
} from '@/core/utils/status-canonical';
import { getAggregatLabel } from '@/core/utils/status-category-labels';
import { statusKurzLabel } from '@/core/utils/status-wert-labels';

/** Die zwei Sektionen des „Alle"-Tabs. */
export type ArbeitsvorratSection = 'in_arbeit' | 'archiv';

/** Anzeige-Label je Sektion (Header-Band) — abgeleitet, nicht als Literal. */
export const ARBEITSVORRAT_LABEL: Record<ArbeitsvorratSection, string> = {
  in_arbeit: getAggregatLabel('arbeitsvorrat'),
  archiv: getAggregatLabel('beendet'),
};

/** Sektions-Zuordnung eines Antrags: terminal → Archiv, sonst Arbeitsvorrat. */
export function arbeitsvorratSectionOf(a: Pick<AntragListItem, 'status'>): ArbeitsvorratSection {
  return isTerminalStatus(a.status) ? 'archiv' : 'in_arbeit';
}

/** Stabiler Zwei-Wege-Split (Reihenfolge innerhalb jeder Sektion = Eingabe). */
export function partitionArbeitsvorrat<T extends Pick<AntragListItem, 'status'>>(
  rows: readonly T[],
): { inArbeit: T[]; archiv: T[] } {
  const inArbeit: T[] = [];
  const archiv: T[] = [];
  for (const r of rows) {
    if (isTerminalStatus(r.status)) archiv.push(r);
    else inArbeit.push(r);
  }
  return { inArbeit, archiv };
}

export interface ArchivAufschluesselung {
  /** Terminal, aber NICHT abgelehnt/zurückgezogen — Schlussvermerk / beendet /
   *  abgebrochen. */
  schlussvermerk: number;
  /** Final negativ: der amtliche `abgelehnt/zurückgezogen` bzw. jeder Wert der
   *  Kategorie `abgelehnt`. */
  abgelehntZurueckgezogen: number;
}

/**
 * Zählt die terminale Teilmenge in ihre zwei Anzeige-Buckets. Nicht-terminale
 * Zeilen werden ignoriert, sodass die Funktion direkt auf der vollen Liste oder
 * der bereits abgespaltenen Archiv-Liste laufen kann.
 */
export function archivAufschluesselung(
  rows: readonly Pick<AntragListItem, 'status'>[],
): ArchivAufschluesselung {
  let schlussvermerk = 0;
  let abgelehntZurueckgezogen = 0;
  for (const r of rows) {
    if (!isTerminalStatus(r.status)) continue;
    if (isAbgelehntZurueckgezogenStatus(r.status)) abgelehntZurueckgezogen++;
    else schlussvermerk++;
  }
  return { schlussvermerk, abgelehntZurueckgezogen };
}

/**
 * Menschenlesbare Kurz-Aufschlüsselung fürs Archiv-Kopf-Rechts:
 * „Schlussvermerk 12 · abgel./zurückgez. 3". Leere Buckets werden weggelassen;
 * beide null → leerer String.
 *
 * Beide Buckets sind nach ihrem dominanten Status benannt und holen ihre
 * Beschriftung deshalb **aus derselben Quelle wie die Status-Pille**
 * (`statusKurzLabel`). Bis v3.15 stand hier eine dritte, wortwörtliche Kopie —
 * sie schrieb `abgelehnt/zurückgez.`, während die Antragsliste daneben
 * `abgel./zurückgez.` zeigte.
 */
export function formatArchivAufschluesselung(a: ArchivAufschluesselung): string {
  const parts: string[] = [];
  if (a.schlussvermerk > 0) {
    parts.push(`${statusKurzLabel('Schlussvermerk')} ${a.schlussvermerk.toLocaleString('de-DE')}`);
  }
  if (a.abgelehntZurueckgezogen > 0) {
    parts.push(
      `${statusKurzLabel(ABGELEHNT_ZURUECKGEZOGEN)} `
      + `${a.abgelehntZurueckgezogen.toLocaleString('de-DE')}`,
    );
  }
  return parts.join(' · ');
}

/** Die zwei Stellungen des „Beendet"-Schalters. */
export type BeendetSicht = 'aus' | 'ein';

/** Optionen des Toolbar-Schalters. Der Wert steht hinter der Beschriftung —
 *  gelesen wird „Beendet: ausgeblendet". */
export const BEENDET_OPTIONS: readonly { key: BeendetSicht; label: string }[] = [
  { key: 'aus', label: 'ausgeblendet' },
  { key: 'ein', label: 'eingeblendet' },
];

/**
 * Beschriftung der Schalter-Zeile im Darstellungs-Menü.
 *
 * Abgeleitet aus dem Aggregatnamen statt als zweites Literal danebengestellt
 * (Pitfall #50) — die Zeile braucht aber ein Verb: der blanke Name („Beendet")
 * neben einem Schalter liest sich als Zustand, nicht als Frage. Ein Test hält
 * beides zusammen, damit eine Umbenennung des Aggregats hier laut auffällt
 * statt still eine schiefe Beugung zu erzeugen.
 */
export const BEENDET_ACHSE_LABEL = `${ARBEITSVORRAT_LABEL.archiv}e zeigen`;

/** Standardstellung: Beendetes steht nicht in der Liste — der Arbeitsvorrat
 *  oben, das Archiv einen Klick entfernt. Der Store persistiert einen Boolean,
 *  hier steht dieselbe Aussage als Schlüssel der Options-Liste (das
 *  Darstellungs-Menü braucht sie, um „weicht ab" zu erkennen). */
export const DEFAULT_BEENDET_SICHT: BeendetSicht = 'aus';

/**
 * Der „Beendet"-Schalter existiert nur im „Alle"-Tab: alle anderen Reiter sind
 * bereits über ihre Status-Sicht geschnitten und enthalten praktisch nichts
 * Terminales — dort wäre der Schalter eine Attrappe.
 *
 * Bewusst OHNE Gruppierungs-Parameter: die Sichtbarkeit beendeter Anträge ist
 * unabhängig davon, ob und wonach gruppiert wird (siehe Kopfkommentar).
 */
export function hatBeendetAchse(activeView: string): boolean {
  return activeView === 'alle';
}

export interface BeendetSichtbarkeit {
  /** Schalter-Stellung: `true` = „Beendet: ausgeblendet". */
  wunsch: boolean;
  suchAktiv: boolean;
  /** Terminale Zeilen im aktuellen Filterergebnis. */
  beendet: number;
  /** Nicht-terminale Zeilen im aktuellen Filterergebnis. */
  arbeitsvorrat: number;
}

/**
 * Effektive Sichtbarkeit: der Wunsch des Nutzers, mit drei Notbremsen, die
 * verhindern, dass Ausblenden zu „da ist nichts" wird.
 *
 * Die Notbremsen setzen den Wunsch NICHT zurück — sie überstimmen ihn nur für
 * diesen Zustand. Sobald die Suche endet, gilt wieder, was der Schalter sagt.
 */
export function istBeendetVersteckt(s: BeendetSichtbarkeit): boolean {
  // Nichts zu verstecken — dann auch keinen Streifen „0 ausgeblendet" zeigen.
  if (s.beendet === 0) return false;
  // Ausschließlich Beendetes: sonst stünde „Keine Anträge" trotz Daten.
  if (s.arbeitsvorrat === 0) return false;
  // Suchtreffer im ausgeblendeten Teil wirkten wie „verschwunden".
  if (s.suchAktiv) return false;
  return s.wunsch;
}
