/**
 * Home-Kopfzeile aus den Eingangs-Ampel-Aggregaten.
 *
 * Eine einheitliche Dringlichkeits-Sprache: dieselben Zahlen wie die
 * Sidebar-Karte `EingangAmpelCard` (beide über `useEingangAmpelCounts`).
 * `offen` = frisch + warnung + kritisch (Ampel-Gesamtzahl), damit die
 * Kopfzeilen-Zahlen den Karten-Zahlen exakt entsprechen.
 *
 * **Alter, nicht Frist** (v2.372.1): der Wert ist das Eingangsalter — die Tage
 * seit `antragsdatum`, siehe `AMPEL_TOOLTIP` in `eingangAmpel.ts`. „über der
 * 90-Tage-Frist" las sich wie ein versäumter Termin, und „nähern sich" hatte
 * gar kein Objekt. Die Tage-Grenzen kommen aus der Widget-Config und werden
 * hier eingesetzt statt fest verdrahtet — vorher stand „90" im Text, während
 * gezählt wurde, was die Config sagte.
 */
import type { AmpelSchwellen } from '@/plugins/antraege/eingangAmpel';

export interface HomeSubtitleParts {
  /** „47 offene Vorgänge" / „1 offener Vorgang" — immer gesetzt. */
  offen: string;
  /** „38 älter als 90 Tage" — null wenn kritisch === 0.
   *  Wird im Render in `--tf-danger-text` gerendert. */
  kritisch: string | null;
  /** „9 zwischen 31 und 90 Tagen" — null wenn warnung === 0. */
  warnung: string | null;
}

const fmt = (n: number): string => n.toLocaleString('de-DE');

/**
 * Baut die drei Teile der Home-Kopfzeile. Der Kritisch-Teil wird getrennt
 * zurückgegeben, weil er im Render farblich hervorgehoben wird. Null-Teile
 * (Zähler 0) lässt der Renderer weg — bei kritisch === 0 ∧ warnung === 0
 * bleibt nur „{n} offene Vorgänge".
 */
export function formatHomeSubtitle(
  counts: { offen: number; kritisch: number; warnung: number },
  schwellen: AmpelSchwellen,
): HomeSubtitleParts {
  const offenWort = counts.offen === 1 ? 'offener Vorgang' : 'offene Vorgänge';
  return {
    offen: `${fmt(counts.offen)} ${offenWort}`,
    kritisch: counts.kritisch > 0
      ? `${fmt(counts.kritisch)} ${labelKritisch(schwellen)}`
      : null,
    warnung: counts.warnung > 0
      ? `${fmt(counts.warnung)} ${labelWarnung(schwellen)}`
      : null,
  };
}

/** „älter als 90 Tage" — auch als Kachel-Beschriftung im Hero-Band. */
export function labelKritisch(schwellen: AmpelSchwellen): string {
  return `älter als ${schwellen.kritischSchwelleTage} Tage`;
}

/** „zwischen 31 und 90 Tagen" — der Bereich, nicht „nähern sich". */
export function labelWarnung(schwellen: AmpelSchwellen): string {
  return `zwischen ${schwellen.warnschwelleTage + 1} und ${schwellen.kritischSchwelleTage} Tagen`;
}
