/**
 * Kontrollfähige Zielkriterien (RL 4.5.1).
 *
 * Eine quantifizierte Delta-Zeile ist bereits das, was der Bescheid später als
 * kontrollfähiges Zielkriterium braucht: Parameter, Ausgangswert, Zielwert,
 * Fundstelle. Diese Datei wählt aus, welche Zeilen dorthin wandern.
 *
 * Nur `quantifiziert` kommt in Frage — eine qualitative Zeile ist per Definition
 * nicht kontrollierbar und hätte im Bescheid nichts zu suchen. Für die fehlt sie
 * nicht, sondern wird zur Präzisions-Nachforderung (`nf-praezision.ts`).
 *
 * Reine Funktionen.
 */
import type { SdtDeltaZeile } from '../infografik/schema';
import { normalisiere } from './schluessel';

export interface Zielkriterium {
  parameter: string;
  sdtWert: string;
  zielWert: string;
  sektionIds: string[];
}

/** Vergleichsschlüssel einer Delta-Zeile für die Abwahl-Liste. Rein. */
export function zielkriteriumSchluessel(parameter: string): string {
  return normalisiere(parameter);
}

/** Kommt die Zeile überhaupt als Zielkriterium in Frage? Rein. */
export function istKandidat(zeile: SdtDeltaZeile): boolean {
  return zeile.quantifizierung === 'quantifiziert';
}

/**
 * Ist die Zeile aktuell übernommen? Default ist AN — nur eine ausdrückliche
 * Abwahl schliesst sie aus. Rein.
 */
export function istUebernommen(
  zeile: SdtDeltaZeile, ausgeschlossen: readonly string[],
): boolean {
  if (!istKandidat(zeile)) return false;
  return !ausgeschlossen.includes(zielkriteriumSchluessel(zeile.parameter));
}

/** Schaltet ein Zielkriterium um und liefert die neue Abwahl-Liste. Rein. */
export function schalte(
  ausgeschlossen: readonly string[], parameter: string, uebernehmen: boolean,
): string[] {
  const key = zielkriteriumSchluessel(parameter);
  const ohne = ausgeschlossen.filter(k => k !== key);
  return uebernehmen ? ohne : [...ohne, key];
}

/** Die übernommenen Zeilen in Reihenfolge des Laufs. Rein. */
export function waehleZielkriterien(
  zeilen: readonly SdtDeltaZeile[], ausgeschlossen: readonly string[],
): Zielkriterium[] {
  return zeilen
    .filter(z => istUebernommen(z, ausgeschlossen))
    .map(z => ({
      parameter: z.parameter,
      sdtWert: z.sdtWert,
      zielWert: z.zielWert,
      sektionIds: z.sektionIds,
    }));
}
