/**
 * Reine Ableitung Kosten → Balken-Segmente.
 *
 * Liefert ein domänen-typisiertes Zwischenergebnis, KEINE `DistributionSegment`s:
 * die tragen einen `tooltip: React.ReactNode`, und dieses Modul soll eine reine,
 * in der Node-Umgebung testbare `.ts`-Datei bleiben. Die Zuordnung auf den
 * geteilten `DistributionBar` macht die Ansicht — sie besteht aus Feldzuweisungen,
 * nicht aus Rechnung.
 */
import type { MapKosten } from '../types';

export interface KostenSegment {
  key: string;
  label: string;
  betrag: number;
  /** Anteil an der Segmentsumme, 0…1. */
  anteil: number;
  /** Deckkraft der Einfärbung — je grösser der Posten, desto kräftiger. */
  deckkraft: number;
}

/** Reihenfolge und Beschriftung der Kostenarten (fachliche Reihenfolge). */
const KOSTENARTEN: ReadonlyArray<{ key: keyof MapKosten; label: string }> = [
  { key: 'personal', label: 'Personal' },
  { key: 'dritte', label: 'Aufträge an Dritte' },
  { key: 'fue', label: 'FuE-Aufträge' },
  { key: 'temp', label: 'Temporäres Personal' },
  { key: 'uebrige', label: 'Übrige Kosten' },
];

/** Deckkraft-Spanne der Einfärbung — kleinste bis grösste Kostenart. */
const DECKKRAFT_MIN = 0.35;
const DECKKRAFT_MAX = 1;

/**
 * Baut die Segmente. Kostenarten ohne Wert oder mit 0 € entfallen — ein Segment
 * der Breite 0 ist kein Informationsgewinn, sondern ein unklickbarer Strich.
 * Leere Liste bei fehlenden Kosten (statt NaN-Anteilen). Rein.
 */
export function baueKostenSegmente(kosten: MapKosten): KostenSegment[] {
  const vorhanden = KOSTENARTEN
    .map(art => ({ ...art, betrag: kosten[art.key] }))
    .filter((a): a is typeof a & { betrag: number } => typeof a.betrag === 'number' && a.betrag > 0);

  const summe = vorhanden.reduce((a, b) => a + b.betrag, 0);
  if (summe <= 0) return [];

  const groesster = Math.max(...vorhanden.map(a => a.betrag));

  return vorhanden.map(art => ({
    key: String(art.key),
    label: art.label,
    betrag: art.betrag,
    anteil: art.betrag / summe,
    deckkraft: DECKKRAFT_MIN + (DECKKRAFT_MAX - DECKKRAFT_MIN) * (art.betrag / groesster),
  }));
}

/**
 * Weicht die Summe der Segmente von den ausgewiesenen Gesamtkosten ab? Die
 * Ansicht zeigt das als Fussnote; der harte Befund kommt aus den Rechenchecks.
 * Rein.
 */
export function summenAbweichung(kosten: MapKosten, segmente: readonly KostenSegment[]): number | null {
  if (kosten.gesamt === null || segmente.length === 0) return null;
  const summe = segmente.reduce((a, s) => a + s.betrag, 0);
  const abweichung = summe - kosten.gesamt;
  return Math.abs(abweichung) < 0.005 ? null : abweichung;
}
