/**
 * Welche Alert-Chips die Hero-Karte „Braucht heute Aufmerksamkeit" zeigt.
 *
 * Pur und ohne React, weil die Codebase keine Render-Tests kennt
 * (`environment: 'node'`, kein `@testing-library`) — Muster wie
 * `abschnittAnzeige.ts`.
 *
 * Die Regel: **eine 0 ist unter dieser Überschrift keine Information.** Bis
 * v2.371 wurden alle drei Chips immer gerendert; „0 QS-Freigaben offen" war
 * damit ein Klickziel, das in die ungefilterte Antragsliste führte. Bleibt
 * kein Chip übrig, entfällt die ganze Karte statt leer dazustehen.
 */

export interface HeroChipEingabe {
  kritisch: number;
  warnung: number;
  qsCount: number;
  /** Sprungziel des QS-Chips (erster offener Entwurf). Ohne Ziel kein Chip. */
  ersteQsScopeId: string | undefined;
}

export interface HeroChipSichtbarkeit {
  kritisch: boolean;
  warnung: boolean;
  qs: boolean;
  /** Mindestens ein Chip → Karte rendern. */
  karte: boolean;
}

export function heroChipSichtbarkeit(eingabe: HeroChipEingabe): HeroChipSichtbarkeit {
  const kritisch = eingabe.kritisch > 0;
  const warnung = eingabe.warnung > 0;
  const qs = eingabe.qsCount > 0 && eingabe.ersteQsScopeId !== undefined;
  return { kritisch, warnung, qs, karte: kritisch || warnung || qs };
}
