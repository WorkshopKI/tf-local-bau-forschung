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
 *
 * Seit v4.41 kommt die Abwahl aus dem `⋯` der Karte dazu. Zwei Gründe, dieselbe
 * Wirkung: die 0 sagt „heute nichts da", die Abwahl „geht mich nichts an".
 */
import type { HeroConfig } from './widgets/types';

export interface HeroChipEingabe {
  kritisch: number;
  warnung: number;
  qsCount: number;
  /** Sprungziel des QS-Chips (erster offener Entwurf). Ohne Ziel kein Chip. */
  ersteQsScopeId: string | undefined;
  /** Karten- und Kachel-Wahl des Nutzers (persönliche Widget-Config). */
  hero: HeroConfig;
}

export interface HeroChipSichtbarkeit {
  kritisch: boolean;
  warnung: boolean;
  qs: boolean;
  /** Mindestens ein Chip → Karte rendern. */
  karte: boolean;
}

export function heroChipSichtbarkeit(eingabe: HeroChipEingabe): HeroChipSichtbarkeit {
  const gewaehlt = eingabe.hero.chips;
  const kritisch = gewaehlt.kritisch && eingabe.kritisch > 0;
  const warnung = gewaehlt.warnung && eingabe.warnung > 0;
  const qs = gewaehlt.qs && eingabe.qsCount > 0 && eingabe.ersteQsScopeId !== undefined;
  return {
    kritisch,
    warnung,
    qs,
    karte: eingabe.hero.sichtbar.alert && (kritisch || warnung || qs),
  };
}
