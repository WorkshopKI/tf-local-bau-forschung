/**
 * Der Anker der Meilenstein-Termine: der **wirksame Eingang** des Verbunds.
 *
 * Soll-Termine (`anker + sollWoche·7`), die laufende Woche und die Gesamtfrist
 * zählen alle ab diesem einen Datum. Bis v6.49 war es das späteste
 * Antragsdatum (`D_AAE`) allein — die Frist-Spalte der Tabelle und der
 * Bestandslauf rechneten dagegen schon mit dem späteren aus `D_AAE` und `D_XTE`
 * („alle Anträge da"). Zweimal „90 Tage ab Eingang" aus verschiedenen
 * Quellspalten; welcher Wert stimmte, hing davon ab, wo man hinsah.
 *
 * **Ein Leser für alle Rechenstellen.** Die Projektion (alle offenen Verbünde)
 * und die Verbund-Detailseite (ein Verbund, auch abgeschlossene) rechneten den
 * Anker je für sich — zwei Wege, die bei der ersten Feinheit auseinanderliefen.
 *
 * `D_XTE` hat kein kanonisches Feld; der Record-Key hängt am Mapping
 * (produktiv: `alle_an_trage_da`). Er wird deshalb über denselben Auflöser
 * gefunden wie die Bedingungsfelder (`loeseFelderAuf`), nie geraten
 * (recurring-bug-classes Klasse 5).
 */
import { parseGermanDate } from '@/core/services/csv/dateParse';
import { verbundWirksamerEingang } from '@/core/services/csv/frist';
import type { CsvSchema } from '@/core/services/csv/types';
import { loeseFelderAuf } from './felder';

/**
 * Die Quellspalten des Ankers. Dieselben Codes, die die Rechnung liest, nennt
 * auch die Erklärung daneben — eine zweite, abgeschriebene Liste wäre ab der
 * nächsten Änderung still falsch.
 */
export const ANKER_SPALTEN = { antragseingang: 'D_AAE', alleAntraegeDa: 'D_XTE' } as const;

/** Liest aus den Teilvorhaben eines Verbunds den Anker (ISO) oder `null`. */
export type AnkerLeser = (tvs: readonly Record<string, unknown>[]) => string | null;

/** Datumswert → ISO; leer → `null`. Unlesbares bleibt stehen und fällt beim Vergleich heraus. */
function alsDatum(v: unknown): string | null {
  if (typeof v !== 'string' || v.trim() === '') return null;
  return parseGermanDate(v) ?? v;
}

/**
 * Baut den Leser EINMAL je Schema-Satz — die Spalten-Auflösung ist ein Durchgang
 * über alle Mappings und gehört nicht in die Schleife über die Verbünde.
 *
 * Mappt kein Schema `D_XTE`, bleibt es beim Antragsdatum: das ist genau der
 * Stand vor v6.49 und damit der ehrliche Rückfall.
 */
export function baueAnkerLeser(schemas: readonly CsvSchema[]): AnkerLeser {
  const [xte] = loeseFelderAuf(schemas, [ANKER_SPALTEN.alleAntraegeDa]);
  const xteKey = xte?.viaSpaltenCode ? xte.recordKey : null;
  return tvs => verbundWirksamerEingang(tvs.map(tv => ({
    antragsdatum: alsDatum(tv.antragsdatum),
    alleAntraegeDa: xteKey ? alsDatum(tv[xteKey]) : null,
  })));
}
