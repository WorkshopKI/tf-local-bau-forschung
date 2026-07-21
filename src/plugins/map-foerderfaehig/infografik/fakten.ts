/**
 * Fakten-Block: die harten Zahlen der Einreichung als kompakte Referenzliste
 * für das Prompt.
 *
 * Zweck ist der Widerspruchscheck. Das Modell soll nicht beurteilen, ob ein Text
 * gut geschrieben ist, sondern ob die Prosa der Vorhabensbeschreibung gegen die
 * Zahlen spricht, die derselbe Antragsteller im Formular eingetragen hat. Dafür
 * braucht es die Zahlen wortwörtlich neben dem Text — deterministisch aus dem
 * Strukturmodell, nie aus einer Modell-Ableitung.
 *
 * DATENSCHUTZ: ausschliesslich Aggregate. Personenbezogenes aus der
 * Einsatzplanung (`MapMitarbeiterKurz.personalNr`, `istNn`) gehört NICHT in
 * diesen Block — es trägt zum Widerspruchscheck nichts bei und hätte im Prompt
 * nichts zu suchen. Der Konventions-Test prüft das.
 *
 * Rein — keine IO, kein Zufall, kein Datum.
 */
import { formatDatum } from '../import/laufzeit';
import type { MapEinreichung } from '../types';

/**
 * Fakten ohne Wert sind keine Vergleichsgrundlage — das Prompt sagt es explizit.
 * EXPORTIERT, damit `schema.ts` den Sentinel interpoliert statt ihn zu wiederholen:
 * die Ausnahmeregel im Prompt war auf den Literalwert verdrahtet und hätte bei einer
 * Änderung hier stumm ins Leere gegriffen (Prompt-Audit 2026-07).
 */
export const OHNE_WERT = 'nicht angegeben';

function euro(n: number | null): string {
  return n === null ? OHNE_WERT : `${n.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;
}

function pm(n: number | null): string {
  return n === null ? OHNE_WERT : `${n.toLocaleString('de-DE')} PM`;
}

function laufzeitZeile(e: MapEinreichung): string {
  const { start, ende, monate } = e.laufzeit;
  if (start === null && ende === null && monate === null) return `- Laufzeit: ${OHNE_WERT}`;
  // Fehlt nur EINE Grenze, lieferte `formatDatum(null)` den Geviertstrich „—" — eine
  // reine UI-Konvention, die die Sentinel-Ausnahme des Prompts nicht abdeckt. Das Modell
  // hätte raten müssen, ob das ein Datum, ein Platzhalter oder ein Fehler ist, und in
  // einem Block, gegen den es Widersprüche melden soll.
  const grenze = (d: string | null): string => (d === null ? OHNE_WERT : formatDatum(d));
  const spanne = `${grenze(start)} bis ${grenze(ende)}`;
  return `- Laufzeit: ${spanne}`
    + (monate === null ? '' : ` (${monate} Monate)`);
}

function arbeitspaketZeilen(e: MapEinreichung): string[] {
  if (e.arbeitspakete.length === 0) return [`- Arbeitspakete: ${OHNE_WERT}`];
  return [
    '- Arbeitspakete und ihr Aufwand (dies ist die vollständige Liste — weitere gibt es nicht):',
    ...e.arbeitspakete.map(ap => {
      const nr = ap.laufnummer === null ? '' : ` (Nr. ${ap.laufnummer})`;
      return `  - „${ap.name}"${nr}: ${pm(ap.aufwandPm)}`;
    }),
  ];
}

function kostenZeilen(e: MapEinreichung): string[] {
  const k = e.kosten;
  return [
    '- Kostenarten:'
      + ` Personal ${euro(k.personal)},`
      + ` Aufträge an Dritte ${euro(k.dritte)},`
      + ` FuE-Ausrüstung ${euro(k.fue)},`
      + ` Personal temporär ${euro(k.temp)},`
      + ` übrige Kosten ${euro(k.uebrige)}`,
    `- Gesamtkosten: ${euro(k.gesamt)}`,
    `- Fördersatz: ${k.foerdersatz === null
      ? OHNE_WERT
      : `${(k.foerdersatz * 100).toLocaleString('de-DE')} %`}`,
    `- Beantragte Zuwendung: ${euro(k.beantragteZuwendung)}`,
    `- Antragstellergrösse (Quellwert des Fördersatzes): ${k.foerdersatzQuelle ?? OHNE_WERT}`,
  ];
}

/**
 * Baut den Fakten-Block. Rein.
 *
 * Die Überschrift ist Teil des Vertrags: das Prompt verweist wörtlich auf
 * „verbindliche Fakten aus der Einreichung", damit das Modell die beiden
 * Quellen (Formular vs. Fliesstext) nicht vermischt.
 */
export function baueFaktenBlock(e: MapEinreichung): string {
  return [
    '## Verbindliche Fakten aus der Einreichung',
    '',
    'Diese Werte stammen aus dem eingereichten Antragsformular, nicht aus der',
    'Vorhabensbeschreibung. Sie sind die Referenz des Abgleichs.',
    '',
    laufzeitZeile(e),
    `- Personenmonate gesamt (Einsatzplanung): ${pm(e.summen.personenmonateEinsatz)}`,
    `- Personenmonate gesamt (Summe Arbeitspakete): ${pm(e.summen.arbeitsaufwandAp)}`,
    ...arbeitspaketZeilen(e),
    ...kostenZeilen(e),
  ].join('\n');
}
