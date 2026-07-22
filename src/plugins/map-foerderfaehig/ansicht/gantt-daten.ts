/**
 * Reine Ableitung Einreichung → Gantt-Zeilen.
 *
 * Die Geometrie kommt aus `aufbereitung/GanttAchse` (`macheAchse`, `GanttGrid`) —
 * dieselbe Achse wie die Zeitplan-Ansichten der Antrag-Aufbereitung, damit beide
 * Module gleich aussehen und die Rechnung nur einmal existiert.
 *
 * Die Achse folgt bewusst der **Projektlaufzeit**, nicht dem spätesten
 * Arbeitspaket: nur so bleibt sichtbar, dass die Arbeitspakete des Dummys bereits
 * im Monat 12 enden, obwohl die Laufzeit 23 Monate läuft. Reicht ein Arbeitspaket
 * über die Laufzeit hinaus, wächst die Achse mit — sonst liefe der Balken aus dem
 * Bild.
 */
import type { MapEinreichung } from '../types';
import { monatsIndex, parseDatum } from '../import/laufzeit';

export interface GanttZeile {
  laufnummer: number | null;
  name: string;
  /** Startmonat, 1-basiert und fraktional (Tagesanteil im Monat). */
  posStart: number;
  /** Endmonat, exklusiv — ein Balken belegt `[posStart … posEnde)`. */
  posEnde: number;
  aufwandPm: number | null;
  /** Überschreitet dieses Arbeitspaket die Personenmonats-Grenze? */
  auffaellig: boolean;
}

export interface GanttDaten {
  zeilen: GanttZeile[];
  achseMax: number;
  /** Arbeitspakete ohne verwertbares Datum — im UI als Hinweis, nicht als Balken. */
  ohneTermin: string[];
}

/**
 * Monatsposition eines Datums relativ zum Projektstart, 1-basiert und
 * fraktional. Der 1. eines Monats liegt exakt auf der Monatsgrenze. Rein.
 */
export function monatsPosition(datum: string | null, start: string | null): number | null {
  const d = parseDatum(datum);
  const s = parseDatum(start);
  if (!d || !s) return null;
  const tageImMonat = new Date(Date.UTC(d.jahr, d.monat, 0)).getUTCDate();
  const anteil = (d.tag - 1) / tageImMonat;
  return monatsIndex(d) - monatsIndex(s) + 1 + anteil;
}

/**
 * Baut die Gantt-Daten. `pmGrenze` markiert auffällige Arbeitspakete — der Wert
 * kommt von aussen, damit die Ansicht nicht selbst über Prüfregeln entscheidet.
 * Rein.
 */
export function baueGanttDaten(e: MapEinreichung, pmGrenze: number): GanttDaten {
  const zeilen: GanttZeile[] = [];
  const ohneTermin: string[] = [];

  for (const ap of e.arbeitspakete) {
    const posStart = monatsPosition(ap.start, e.laufzeit.start);
    const posEndeRoh = monatsPosition(ap.ende, e.laufzeit.start);
    if (posStart === null || posEndeRoh === null) {
      ohneTermin.push(ap.name);
      continue;
    }
    zeilen.push({
      laufnummer: ap.laufnummer,
      name: ap.name,
      posStart,
      // Das Enddatum gehört noch zum Vorhaben — der Balken reicht bis zum
      // Ende dieses Tages, also mindestens eine schmale Breite.
      posEnde: Math.max(posEndeRoh + 0.03, posStart + 0.03),
      aufwandPm: ap.aufwandPm,
      auffaellig: ap.aufwandPm !== null && ap.aufwandPm > pmGrenze,
    });
  }

  const ausLaufzeit = e.laufzeit.monate ?? 0;
  const ausBalken = zeilen.reduce((max, z) => Math.max(max, Math.ceil(z.posEnde)), 0);

  return { zeilen, achseMax: Math.max(1, ausLaufzeit, ausBalken), ohneTermin };
}

/** Letzter terminierter Monat — Grundlage der Leerflächen-Annotation. Rein. */
export function letzterTerminierterMonat(daten: GanttDaten): number {
  return daten.zeilen.reduce((max, z) => Math.max(max, Math.ceil(z.posEnde)), 0);
}
