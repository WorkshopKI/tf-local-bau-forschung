/**
 * Reine Auswahl-Logik der Monitoring-Tabs — Filtern, Sortieren, Sammeln.
 * Ohne React, damit sie ohne DOM testbar ist (Muster `kanbanLanes.ts`).
 *
 * Zwei Ebenen, bewusst getrennt: der **Jahrgang** ist ein bereichsweiter
 * Vorfilter (die Seite wendet ihn einmal an und reicht die Ergebnisse an alle
 * Tabs durch), der **Übersicht-Filter** wirkt nur innerhalb der Liste. Das
 * Bezugsjahr kommt überall als Parameter herein, damit nichts an der Uhr hängt.
 *
 * Bewusst KEIN eigener Zustandsbegriff: „überfällig" ist genau `gerissen`,
 * „diese Woche fällig" genau `faellig` (das 7-Tage-Fenster der Engine). Eine
 * zweite Schwellen-Definition in der Oberfläche würde von der Engine abweichen,
 * sobald jemand eine der beiden anfasst.
 */
import { parseGermanDate } from '@/core/services/csv/dateParse';
import type { MeilensteinPlan, MstZustand, Prognose } from '@/core/meilensteine';
import type { AntragstypBucket } from '@/core/utils/vb-phase-mappings';
import type { VerbundZeile } from './useMeilensteinStand';

const MS_TAG = 86_400_000;

/** Dringlichkeits-Rang: Prognose schlägt Restzeit. */
const PROGNOSE_RANG: Record<Prognose, number> = {
  nichtHaltbar: 0, gefaehrdet: 1, imPlan: 2, unbekannt: 3, abgeschlossen: 4,
};

// ---------------------------------------------------------------------------
// Jahrgang — der bereichsweite Vorfilter (Übersicht, Diese Woche, Auswertung)
// ---------------------------------------------------------------------------

/** Gewählter Jahrgang des Antragseingangs; als Zustand ist `null` = alle Jahre. */
export interface JahrBereich {
  von: number;
  bis: number;
}

/** Wie viele Jahre die Chip-Leiste einzeln zur Kurzwahl anbietet. */
export const JAHR_CHIPS = 3;

/**
 * Bezugsjahr des Moduls. Kommt aus dem Bewertungs-Stand, nicht aus der Uhr —
 * derselbe Zeitpunkt, auf den sich alle Zustände beziehen.
 */
export function standJahr(stand: string): number {
  return antragsJahr(stand) ?? new Date().getFullYear();   // Fallback rein defensiv
}

/**
 * Jahr des Antragseingangs, `null` ohne verwertbares Datum.
 *
 * Bewusst über `parseGermanDate` statt `slice(0,4)`: der CSV-Merger legt
 * unparsebare Werte wörtlich ab, und es ist derselbe Parser, den die Engine auf
 * genau diesem Feld benutzt — Filter und Bewertung können so nie über die
 * Gültigkeit eines Datums streiten. `new Date(…).getFullYear()` wäre falsch:
 * Datums-only-ISO wird als UTC-Mitternacht gelesen und lokal zurückgerechnet.
 */
export function antragsJahr(antragsdatum: string | null | undefined): number | null {
  const iso = antragsdatum ? parseGermanDate(antragsdatum) : null;
  return iso === null ? null : Number(iso.slice(0, 4));
}

/** Vorbelegung des Bereichs: laufendes Jahr und das Jahr davor. */
export function standardBereich(currentYear: number): JahrBereich {
  return { von: currentYear - 1, bis: currentYear };
}

/**
 * Jahre der Kurzwahl-Chips, neuestes zuerst. Abgeleitet aus `currentYear` und
 * nicht aus den Daten — sonst könnte die Vorbelegung ein Jahr enthalten, für das
 * es (etwa im Januar) noch gar keinen Chip gibt.
 */
export function jahrChips(currentYear: number): number[] {
  return Array.from({ length: JAHR_CHIPS }, (_, i) => currentYear - i);
}

/**
 * Umfang der Von/Bis-Listen: alles, was in den Daten vorkommt, mindestens aber
 * das laufende Jahr (damit es auch ohne Anträge wählbar bleibt).
 */
export function jahrSpanne(
  datumsWerte: readonly (string | null | undefined)[], currentYear: number,
): JahrBereich {
  let von = currentYear;
  let bis = currentYear;
  for (const d of datumsWerte) {
    const j = antragsJahr(d);
    if (j === null) continue;
    if (j < von) von = j;
    if (j > bis) bis = j;
  }
  return { von, bis };
}

/**
 * Passt der Jahrgang zur Auswahl? Ohne Bereich zählt alles.
 *
 * Ohne verwertbares Antragsdatum gibt es keinen Jahrgang — solche Vorgänge
 * fallen bei aktivem Bereich heraus, statt jede Auswahl still zu „Jahr X oder
 * unbekannt" umzudeuten. Unter „Alle Jahre" sind sie wieder da.
 */
export function passtZuBereich(
  antragsdatum: string | null | undefined, bereich: JahrBereich | null,
): boolean {
  if (bereich === null) return true;
  const j = antragsJahr(antragsdatum);
  if (j === null) return false;
  return j >= bereich.von && j <= bereich.bis;
}

/** Untere Grenze setzen; die obere wird mitgezogen, statt den Bereich zu drehen. */
export function setzeVon(bereich: JahrBereich, jahr: number): JahrBereich {
  return { von: jahr, bis: Math.max(jahr, bereich.bis) };
}

/** Obere Grenze setzen; die untere wird mitgezogen, statt den Bereich zu drehen. */
export function setzeBis(bereich: JahrBereich, jahr: number): JahrBereich {
  return { von: Math.min(jahr, bereich.von), bis: jahr };
}

// ---------------------------------------------------------------------------
// Übersicht — die Filter innerhalb der Liste
// ---------------------------------------------------------------------------

export interface UebersichtFilter {
  suche: string;
  typen: AntragstypBucket[];
  prognosen: Prognose[];
  nurMeine: boolean;
}

export const LEERER_FILTER: UebersichtFilter = {
  suche: '', typen: [], prognosen: [], nurMeine: false,
};

/**
 * Filtert und sortiert die Übersicht. Dringendstes zuerst — ein Vorgang mit
 * gerissener Frist gehört nach oben, auch wenn ein anderer kalendarisch knapper
 * dran ist.
 */
export function filtereZeilen(
  zeilen: readonly VerbundZeile[], filter: UebersichtFilter, meinKuerzel: string,
): VerbundZeile[] {
  const suche = filter.suche.trim().toLowerCase();
  const kuerzel = meinKuerzel.trim().normalize('NFC');
  return zeilen
    .filter(z => {
      if (filter.typen.length > 0 && (z.typ === null || !filter.typen.includes(z.typ))) return false;
      if (filter.prognosen.length > 0 && !filter.prognosen.includes(z.prognose)) return false;
      if (filter.nurMeine && (!kuerzel || !z.kuerzel.includes(kuerzel))) return false;
      if (suche && !`${z.akronym} ${z.titel} ${z.verbundId}`.toLowerCase().includes(suche)) return false;
      return true;
    })
    .sort((a, b) => {
      const p = PROGNOSE_RANG[a.prognose] - PROGNOSE_RANG[b.prognose];
      if (p !== 0) return p;
      const ra = a.restTage ?? Number.POSITIVE_INFINITY;
      const rb = b.restTage ?? Number.POSITIVE_INFINITY;
      if (ra !== rb) return ra - rb;
      return a.akronym.localeCompare(b.akronym, 'de');
    });
}

export interface WochenPunkt {
  verbundId: string;
  akronym: string;
  titel: string;
  knotenId: string;
  nummer: string;
  label: string;
  zustand: Extract<MstZustand, 'gerissen' | 'faellig'>;
  sollDatum: string | null;
  /** Tage bis zum Soll-Termin (negativ = überfällig). */
  restTage: number | null;
  kuerzel: string[];
  prognose: Prognose;
}

/**
 * Sammelt gerissene und fällige Meilensteine über alle Verbünde, am weitesten
 * überfällig zuerst. `heute` kommt von außen (Testbarkeit).
 */
export function sammleWochenPunkte(
  zeilen: readonly VerbundZeile[], plan: MeilensteinPlan, heute: string,
): WochenPunkt[] {
  const knotenById = new Map(plan.knoten.map(k => [k.id, k]));
  const heuteMs = new Date(heute).getTime();
  const out: WochenPunkt[] = [];

  for (const z of zeilen) {
    for (const e of z.ergebnisse) {
      if (e.zustand !== 'gerissen' && e.zustand !== 'faellig') continue;
      const k = knotenById.get(e.knotenId);
      if (!k) continue;
      const sollMs = e.sollDatum ? new Date(e.sollDatum).getTime() : NaN;
      out.push({
        verbundId: z.verbundId,
        akronym: z.akronym,
        titel: z.titel,
        knotenId: k.id,
        nummer: k.nummer,
        label: k.label,
        zustand: e.zustand,
        sollDatum: e.sollDatum,
        restTage: Number.isNaN(sollMs) ? null : Math.ceil((sollMs - heuteMs) / MS_TAG),
        kuerzel: z.kuerzel,
        prognose: z.prognose,
      });
    }
  }

  return out.sort((a, b) => {
    const ra = a.restTage ?? Number.POSITIVE_INFINITY;
    const rb = b.restTage ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    return a.akronym.localeCompare(b.akronym, 'de');
  });
}

/** Auf das eigene Kürzel eingegrenzt; ohne Kürzel unverändert. */
export function nurMeinePunkte(punkte: readonly WochenPunkt[], meinKuerzel: string): WochenPunkt[] {
  const k = meinKuerzel.trim().normalize('NFC');
  return k ? punkte.filter(p => p.kuerzel.includes(k)) : [...punkte];
}
