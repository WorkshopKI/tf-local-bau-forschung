/**
 * Texte der Home-Dringlichkeits-Sprache — Kopfzeile und Hero-Kacheln.
 *
 * **Alter, nicht Frist** (v2.372.1): der Wert ist das Eingangsalter — die Tage
 * seit `antragsdatum`, siehe `AMPEL_TOOLTIP` in `eingangAmpel.ts`. „über der
 * 90-Tage-Frist" las sich wie ein versäumter Termin, und „nähern sich" hatte
 * gar kein Objekt. Die Tage-Grenzen kommen aus der Widget-Config und werden
 * eingesetzt statt fest verdrahtet — vorher stand „90" im Text, während
 * gezählt wurde, was die Config sagte.
 *
 * **Die Kopfzeile nennt nur noch die Gesamtzahl** (v2.372.2): die Aufteilung
 * kritisch/warnung stand wortgleich zwei Zeilen tiefer als klickbare Kacheln im
 * Hero-Band und ein drittes Mal im Antragseingang-Widget. Von drei Darstellungen
 * derselben zwei Zahlen ist die nicht-klickbare Textzeile die entbehrlichste.
 * Die beiden Label-Funktionen bleiben — sie beschriften jetzt die Kacheln.
 *
 * `offen` = frisch + warnung + kritisch, also offene Anträge **mit gültigem
 * Eingangsdatum**. Das ist die verabredete Bedeutung von „offen" auf der
 * Startseite; die Antragsliste zeigt unter „Offen" dieselbe Zahl.
 */
import type { AmpelSchwellen } from '@/plugins/antraege/eingangAmpel';

const fmt = (n: number): string => n.toLocaleString('de-DE');

/** „47 offene Vorgänge" / „1 offener Vorgang". */
export function formatHomeSubtitle(offen: number): string {
  return `${fmt(offen)} ${offen === 1 ? 'offener Vorgang' : 'offene Vorgänge'}`;
}

/** „älter als 90 Tage" — Kachel-Beschriftung im Hero-Band. */
export function labelKritisch(schwellen: AmpelSchwellen): string {
  return `älter als ${schwellen.kritischSchwelleTage} Tage`;
}

/** „zwischen 31 und 90 Tagen" — der Bereich, nicht „nähern sich". */
export function labelWarnung(schwellen: AmpelSchwellen): string {
  return `zwischen ${schwellen.warnschwelleTage + 1} und ${schwellen.kritischSchwelleTage} Tagen`;
}
