/**
 * Die Trefferzahl rechts über der Liste — **was sie zählt, und dass sie nie
 * eine alte Zahl zeigt.**
 *
 * Zwei Fehler steckten in der bisherigen Zahl:
 *
 * 1. **Sie fror ein.** Die Zahl kam aus einem Effekt der Tabelle. Bei null
 *    Treffern rendert `AntraegeMain` die Tabelle gar nicht — der Effekt lief
 *    nie, der Wert des vorigen Reiters blieb stehen („NF: 0 Zeilen, 97
 *    Anträge"). Dagegen steht hier ein harter Guard: kein Treffer ⇒ null,
 *    unabhängig von jeder Meldung. Und eine Meldung zählt nur für den
 *    View-Modus, aus dem sie stammt — sonst überlebte die Tabellen-Zahl den
 *    Wechsel in die Karten-Ansicht.
 * 2. **Sie sagte nicht, was sie zählt.** Alle Zähler der Seite (Reiter,
 *    Status-Pillen, Sektions-Bänder, diese Zahl) zählen **Teilvorhaben**. Nur
 *    die Liste fasst sie bei aktiver Gruppierung zu weniger Zeilen zusammen —
 *    17 TV wurden zu 12 Verbund-Zeilen, und nichts erklärte die Differenz.
 *    Deshalb nennt die Zahl ihre Einheit und stellt die Zeilenzahl daneben,
 *    sobald verdichtet wird.
 *
 * Rein und ohne React — die Renderer melden, `AntraegeMain` zeigt an.
 */
import type { ViewMode } from './viewModes';

/** Wie die Liste mehrere Teilvorhaben zu einer Zeile zusammenfasst. */
export type VerdichtungsArt =
  /** Tabellen-Gruppierung „Verbund": eine Zeile je Verbund. */
  | 'verbund'
  /** Listen-Gruppierung (Status-/Netzwerk-Cluster): eine Karte je Gruppe. */
  | 'gruppe';

/** Was ein Renderer über die von ihm gebauten Zeilen meldet. */
export interface ZeilenMeldung {
  /** View-Modus, aus dem die Meldung stammt — eine Meldung aus einem anderen
   *  Modus ist nach dem Wechsel wertlos und wird verworfen. */
  quelle: ViewMode;
  /** Teilvorhaben nach ALLEN Filtern (inkl. Spaltenfilter der Tabelle). */
  tv: number;
  /** Zeilen/Karten, die daraus entstehen. Gleich `tv`, wenn nichts verdichtet. */
  zeilen: number;
  /** Art der Verdichtung — `null`, wenn jede Zeile ein Teilvorhaben ist. */
  art: VerdichtungsArt | null;
}

export interface Trefferzahl {
  tv: number;
  zeilen: number;
  art: VerdichtungsArt | null;
}

const LEER: Trefferzahl = { tv: 0, zeilen: 0, art: null };

/**
 * Die anzuzeigende Trefferzahl.
 *
 * `filteredLength` ist die Länge der gefilterten Liste, wie `AntraegeMain` sie
 * kennt — sie ist die **Wahrheit über „gibt es überhaupt Treffer"**. Die
 * Meldung verfeinert sie nur (Spaltenfilter, Zeilenzahl) und darf sie nie
 * überstimmen.
 */
export function berechneTrefferZahl(
  viewMode: ViewMode,
  filteredLength: number,
  meldung: ZeilenMeldung | null,
): Trefferzahl {
  if (filteredLength <= 0) return LEER;
  if (meldung === null || meldung.quelle !== viewMode) {
    return { tv: filteredLength, zeilen: filteredLength, art: null };
  }
  if (meldung.tv <= 0) return LEER;
  return { tv: meldung.tv, zeilen: meldung.zeilen, art: meldung.art };
}

const ZEILEN_WORT: Record<VerdichtungsArt, { eine: string; viele: string }> = {
  verbund: { eine: 'Verbund-Zeile', viele: 'Verbund-Zeilen' },
  gruppe: { eine: 'Gruppe', viele: 'Gruppen' },
};

const fmt = (n: number): string => n.toLocaleString('de-DE');

/**
 * Beschriftung der Trefferzahl. „Teilvorhaben" ist im Deutschen im Singular
 * wie im Plural gleich — nur das Zeilen-Wort wird gebeugt.
 *
 * - ohne Verdichtung: `„294 Teilvorhaben"`
 * - mit Verdichtung:  `„17 Teilvorhaben · 12 Verbund-Zeilen"`
 */
export function formatTrefferZahl(z: Trefferzahl): string {
  const basis = `${fmt(z.tv)} Teilvorhaben`;
  if (z.art === null || z.zeilen === z.tv) return basis;
  const wort = ZEILEN_WORT[z.art];
  return `${basis} · ${fmt(z.zeilen)} ${z.zeilen === 1 ? wort.eine : wort.viele}`;
}

/** Tooltip: benennt die Ebene, auf der die übrigen Zähler der Seite zählen. */
export function trefferZahlTitel(z: Trefferzahl): string {
  const basis = 'Reiter und Status-Pillen zählen ebenfalls Teilvorhaben.';
  if (z.art === null || z.zeilen === z.tv) return basis;
  return z.art === 'verbund'
    ? `${basis} Die Tabelle fasst sie gerade zu einer Zeile je Verbund zusammen.`
    : `${basis} Die Liste fasst sie gerade zu Gruppen zusammen.`;
}
