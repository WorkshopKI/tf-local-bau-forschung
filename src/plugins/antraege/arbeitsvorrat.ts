/**
 * Arbeitsvorrat/Archiv-Split für den „Alle"-Tab (Journey-Paket 2 Phase 5).
 *
 * Der „Alle"-Tab mischt aktive Anträge mit längst abgeschlossenen — der
 * Arbeitsvorrat (nicht-terminal) verschwindet im Archiv-Rauschen. Diese
 * pure Schicht teilt die gefilterte Liste in zwei kontiguierliche Sektionen:
 * **Arbeitsvorrat** (nicht-terminal, oben) und **Beendet** (terminal, unten,
 * default eingeklappt).
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
} from '@/core/utils/status-canonical';
import { getAggregatLabel } from '@/core/utils/status-category-labels';

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
 * „Schlussvermerk 12 · abgelehnt/zurückgez. 3". Leere Buckets werden
 * weggelassen; beide null → leerer String.
 */
export function formatArchivAufschluesselung(a: ArchivAufschluesselung): string {
  const parts: string[] = [];
  if (a.schlussvermerk > 0) {
    parts.push(`Schlussvermerk ${a.schlussvermerk.toLocaleString('de-DE')}`);
  }
  if (a.abgelehntZurueckgezogen > 0) {
    parts.push(`abgelehnt/zurückgez. ${a.abgelehntZurueckgezogen.toLocaleString('de-DE')}`);
  }
  return parts.join(' · ');
}

/**
 * Effektiver Archiv-Collapsed-Zustand: der persistierte Wunsch, ABER bei
 * aktiver Suche mit Archiv-Treffern zwangs-aufgeklappt — sonst wirken
 * Treffer im (eingeklappten) Archiv wie „verschwunden".
 */
export function isArchivCollapsedEffective(
  persistedCollapsed: boolean,
  searchActive: boolean,
  archivHitCount: number,
): boolean {
  if (searchActive && archivHitCount > 0) return false;
  return persistedCollapsed;
}

/**
 * Arbeitsvorrat-Sektionierung greift nur im „Alle"-Tab und nur ohne aktive
 * Gruppierung (Verbund/Status/Netzwerk ersetzen die Sektionierung, statt sie
 * zu verschachteln). Grouping als String, weil Tabelle (`TableGroupingMode`)
 * und Liste (`GroupingMode`) beide `'none'` kennen.
 */
export function isArbeitsvorratView(activeView: string, grouping: string): boolean {
  return activeView === 'alle' && grouping === 'none';
}
